const admin = require("firebase-admin");
const serviceAccount = require("./firebaseServiceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function preencherNumeros() {
  const batch = db.batch();

  for (let i = 1; i <= 1000; i++) {
    const ref = db.collection("numeros").doc(i.toString());
    batch.set(ref, { status: "disponivel" }); // SEM acento, igual ao backend
  }

  await batch.commit();
  console.log("✅ Números de 1 a 1000 preenchidos com status 'disponivel'");
}

preencherNumeros();
