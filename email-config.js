/**
 * Booking notification email settings.
 *
 * Preferred: Web3Forms → rallypoint.hr@gmail.com
 *   1. Sign up at https://web3forms.com
 *   2. Create a form and copy the access key below.
 *
 * Alternate: EmailJS → rallypoint.hr@gmail.com
 *   1. Sign up at https://www.emailjs.com
 *   2. Create a service, template, and public key.
 *   3. Paste service/template/public key below.
 *
 * Fallback: FormSubmit.co → rallypoint.hr@gmail.com
 *   This works only from a real web server and requires activation.
 */
window.RALLY_EMAIL_CONFIG = {
  notifyEmail: 'rallypoint.hr@gmail.com',
  formspreeEndpoint: 'https://formspree.io/f/mojbnlvn',
  web3formsAccessKey: '680c3979-af76-499f-9bad-1103433f9726',
  emailjsServiceId: 'service_9xkg4zo',
  emailjsTemplateId: 'template_ti652mb',
  emailjsPublicKey: '99SjU3IztndLCE_sI',
  firebaseConfig: {
    apiKey: "AIzaSyBcFnPRebnLewLmbcEuoLDLsTWyjOqnj5M",
    authDomain: "rally-po.firebaseapp.com",
    projectId: "rally-po",
    storageBucket: "rally-po.firebasestorage.app",
    messagingSenderId: "369415952800",
    appId: "1:369415952800:web:fad5153b972c892cd56cc5"
  },
  resetBookingsOnLoad: false
};
