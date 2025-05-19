import React, { useEffect, useState } from "react";
import axios from "axios";

const TOTAL_NUMEROS = 1000;

const App = () => {
  const [numeros, setNumeros] = useState([]);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [numerosSelecionados, setNumerosSelecionados] = useState([]);
  const [linkPagamento, setLinkPagamento] = useState("");

  useEffect(() => {
    const buscarNumeros = async () => {
      try {
        const response = await axios.get("https://rifa-project-08f5.onrender.com/numeros");
        setNumeros(response.data);
      } catch (err) {
        alert("Erro ao buscar números: " + err.message);
      }
    };
    buscarNumeros();
  }, []);

  const toggleNumero = (numero) => {
    const info = numeros.find((n) => n.numero === numero.toString());
    if (info?.status === "pago" || info?.status === "reservado") return;

    setNumerosSelecionados((prev) =>
      prev.includes(numero)
        ? prev.filter((n) => n !== numero)
        : [...prev, numero]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (numerosSelecionados.length === 0) {
      alert("Selecione pelo menos um número disponível!");
      return;
    }

    try {
      const response = await axios.post("https://rifa-project-08f5.onrender.com/create-payment", {
        nome,
        telefone,
        numeros: numerosSelecionados,
      });
      setLinkPagamento(response.data.init_point);
    } catch (error) {
      alert("Erro ao criar pagamento: " + (error.response?.data?.error || error.message));
    }
  };

  const renderNumero = (numero) => {
    const info = numeros.find((n) => n.numero === numero.toString());
    const status = info?.status;

    let bgColor = "bg-green-500 hover:bg-green-600";
    if (status === "pago") bgColor = "bg-red-500 cursor-not-allowed";
    else if (status === "reservado") bgColor = "bg-yellow-400 cursor-not-allowed";
    else if (numerosSelecionados.includes(numero)) bgColor = "bg-blue-600 scale-105";

    return (
      <button
        key={numero}
        onClick={() => toggleNumero(numero)}
        disabled={status === "pago" || status === "reservado"}
        className={`w-10 h-10 md:w-12 md:h-12 text-sm font-semibold text-white rounded-md shadow flex items-center justify-center transition transform ${bgColor}`}
        title={
          status === "pago" ? "Já pago" :
          status === "reservado" ? "Reservado" :
          "Disponível"
        }
      >
        {numero}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-center text-gray-800 mb-10">
          🎟️ Rifa Premiada — Escolha seus números
        </h1>

        <div className="bg-white p-6 rounded-2xl shadow-lg mb-10">
          <div className="grid grid-cols-5 sm:grid-cols-10 md:grid-cols-20 gap-2 justify-center">
            {Array.from({ length: TOTAL_NUMEROS }, (_, i) => renderNumero(i + 1))}
          </div>
          {numerosSelecionados.length > 0 && (
            <p className="mt-4 text-center text-gray-700 font-medium">
              Números selecionados:{" "}
              <span className="text-blue-600 font-bold">
                {numerosSelecionados.sort((a, b) => a - b).join(", ")}
              </span>
            </p>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 rounded-2xl shadow-xl max-w-lg mx-auto space-y-4"
        >
          <h2 className="text-xl font-semibold text-center text-gray-700 mb-2">
            Preencha seus dados para gerar o pagamento
          </h2>
          <input
            type="text"
            placeholder="Seu nome completo"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring focus:outline-none"
          />
          <input
            type="tel"
            placeholder="WhatsApp com DDD"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring focus:outline-none"
          />
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition"
          >
            💸 Gerar Pagamento
          </button>
        </form>

        {linkPagamento && (
          <div className="text-center mt-6">
            <a
              href={linkPagamento}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-lg transition"
            >
              ✅ Clique aqui para pagar com PIX
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
