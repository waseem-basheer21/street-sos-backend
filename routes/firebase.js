// firebase.js
const admin = require('firebase-admin');
const serviceAccount = require('../street-sos-fdeae-firebase-adminsdk-u23br-f0b8376cab.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'gs://street-sos-fdeae.appspot.com'
});

const bucket = admin.storage().bucket();

module.exports = { bucket };