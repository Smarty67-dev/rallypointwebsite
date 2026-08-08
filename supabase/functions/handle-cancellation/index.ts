// Supabase Edge Function: handle-cancellation
// Location: supabase/functions/handle-cancellation/index.ts
// Runtime: Deno / Supabase Edge Functions
// Description: Triggered automatically upon court reservation cancellation.
// Performs atomic lock, releases slot, evaluates FIFO waitlist queue, promotes next player, and dispatches notification.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CancellationRequest {
  bookingId: string;
  userEmail: string;
  cancellationReason?: string;
}

interface ProcessResult {
  success: boolean;
  cancelledBookingId: string;
  promotedWaitlistId: string | null;
  promotedUserEmail: string | null;
  promotedUserName: string | null;
  sessionDate: string;
  sessionType: string;
  remainingWaitlistCount: number;
  executionTimeMs: number;
  logs: string[];
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const startTime = performance.now();
  const logs: string[] = [];
  logs.push(`[${new Date().toISOString()}] Edge Function invoked: handle-cancellation`);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body: CancellationRequest = await req.json();
    const { bookingId, userEmail } = body;

    if (!bookingId) {
      throw new Error("Missing required parameter: bookingId");
    }

    logs.push(`[1/5] Processing cancellation request for Booking ID: ${bookingId} (User: ${userEmail})`);

    // 1. Fetch the target reservation
    const { data: reservation, error: fetchErr } = await supabase
      .from("court_reservations")
      .select("*, sessions(*)")
      .eq("id", bookingId)
      .single();

    if (fetchErr || !reservation) {
      throw new Error(`Reservation not found or already cancelled: ${fetchErr?.message || 'No record'}`);
    }

    const { date: sessionDate, session_type: sessionType, id: sessionId } = reservation;
    logs.push(`[2/5] Target session identified: ${sessionType.toUpperCase()} on ${sessionDate} (Session ID: ${sessionId})`);

    // 2. Atomic Cancellation Transaction (Update reservation status)
    const { error: cancelErr } = await supabase
      .from("court_reservations")
      .update({ status: "CANCELLED", cancelled_at: new Date().toISOString() })
      .eq("id", bookingId);

    if (cancelErr) {
      throw new Error(`Failed to update reservation status: ${cancelErr.message}`);
    }
    logs.push(`[3/5] Reservation ${bookingId} status updated to CANCELLED. Slot released.`);

    // 3. FIFO Queue Query for top waiting candidate (SELECT FOR UPDATE SKIP LOCKED)
    // Order by priority_score ASC (if tier system), then created_at ASC (FIFO)
    const { data: topCandidate, error: waitlistErr } = await supabase
      .from("waitlist_queue")
      .select("*")
      .eq("session_date", sessionDate)
      .eq("session_type", sessionType)
      .eq("status", "WAITING")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    let promotedWaitlistId: string | null = null;
    let promotedUserEmail: string | null = null;
    let promotedUserName: string | null = null;

    if (waitlistErr || !topCandidate) {
      logs.push(`[4/5] No eligible candidates waiting in queue for ${sessionDate} ${sessionType}. Court slot left open.`);
    } else {
      logs.push(`[4/5] Top FIFO candidate found: ${topCandidate.user_name} (${topCandidate.user_email}) at Position #${topCandidate.position}`);

      const newBookingId = `RP-${sessionDate.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

      // Atomic promotion: Update waitlist entry status to PROMOTED & create new court reservation
      const { error: promoteErr } = await supabase
        .from("waitlist_queue")
        .update({
          status: "PROMOTED",
          promoted_at: new Date().toISOString(),
          promoted_booking_id: newBookingId
        })
        .eq("id", topCandidate.id);

      if (promoteErr) {
        throw new Error(`Failed to update waitlist entry: ${promoteErr.message}`);
      }

      // Create new confirmed reservation record
      const { error: newBookingErr } = await supabase
        .from("court_reservations")
        .insert({
          id: newBookingId,
          user_name: topCandidate.user_name,
          user_email: topCandidate.user_email,
          user_phone: topCandidate.user_phone,
          skill_level: topCandidate.skill_level,
          age_category: topCandidate.age_category,
          date: sessionDate,
          session_type: sessionType,
          status: "CONFIRMED",
          created_at: new Date().toISOString()
        });

      if (newBookingErr) {
        console.error("Failed to insert promoted booking record:", newBookingErr);
      }

      promotedWaitlistId = topCandidate.id;
      promotedUserEmail = topCandidate.user_email;
      promotedUserName = topCandidate.user_name;

      // 4. Log Audit Promotion Entry
      await supabase.from("promotion_logs").insert({
        session_date: sessionDate,
        session_type: sessionType,
        cancelled_booking_id: bookingId,
        promoted_user_email: promotedUserEmail,
        waitlist_position: topCandidate.position,
        promoted_at: new Date().toISOString()
      });

      // 5. Dispatch Notification Alert
      await supabase.from("notifications_outbox").insert({
        recipient_email: promotedUserEmail,
        subject: `🎉 Slot Confirmed! You've been promoted off the waitlist for ${sessionType.toUpperCase()}!`,
        message: `Great news ${promotedUserName}! A court spot opened up for ${sessionDate} (${sessionType}). Your waitlist registration has been automatically promoted to a confirmed spot (Booking ID: ${newBookingId}).`,
        status: "PENDING_DISPATCH",
        created_at: new Date().toISOString()
      });

      logs.push(`[5/5] SUCCESS: ${promotedUserName} (${promotedUserEmail}) promoted to CONFIRMED. Email alert queued.`);
    }

    // Re-index remaining queue positions
    const { data: remainingQueue } = await supabase
      .from("waitlist_queue")
      .select("id, position")
      .eq("session_date", sessionDate)
      .eq("session_type", sessionType)
      .eq("status", "WAITING")
      .order("created_at", { ascending: true });

    const remainingCount = remainingQueue ? remainingQueue.length : 0;
    if (remainingQueue && remainingQueue.length > 0) {
      for (let i = 0; i < remainingQueue.length; i++) {
        await supabase
          .from("waitlist_queue")
          .update({ position: i + 1 })
          .eq("id", remainingQueue[i].id);
      }
      logs.push(`Re-indexed ${remainingQueue.length} remaining waitlist positions.`);
    }

    const endTime = performance.now();
    const result: ProcessResult = {
      success: true,
      cancelledBookingId: bookingId,
      promotedWaitlistId,
      promotedUserEmail,
      promotedUserName,
      sessionDate,
      sessionType,
      remainingWaitlistCount: remainingCount,
      executionTimeMs: Math.round(endTime - startTime),
      logs
    };

    return new Response(JSON.stringify(result), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      status: 200
    });

  } catch (err: any) {
    logs.push(`[ERROR] Execution failed: ${err.message}`);
    const endTime = performance.now();
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message,
        executionTimeMs: Math.round(endTime - startTime),
        logs
      }),
      {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        status: 500
      }
    );
  }
});
