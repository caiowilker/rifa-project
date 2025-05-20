const admin = require("firebase-admin");
const serviceAccount = require("./firebaseServiceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function preencherNumeros() {
  const numerosPagos = ["48", "205", "215", "225", "235", "113"];
  const lista = {};

  for (let i = 1; i <= 1000; i++) {
    const numStr = i.toString();
    if (numerosPagos.includes(numStr)) {
      lista[numStr] = { status: "pago" };
    } else {
      lista[numStr] = { status: "disponivel" };
    }
  }

  await db.collection("rifa").doc("numeros").set({ lista });
  console.log("✅ Números preenchidos com status 'disponivel' e números pagos definidos.");
}

preencherNumeros();
