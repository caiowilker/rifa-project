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
        const response = await axios.get("http://localhost:3000/numeros");
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

    if (numerosSelecionados.includes(numero)) {
      setNumerosSelecionados((prev) => prev.filter((n) => n !== numero));
    } else {
      setNumerosSelecionados((prev) => [...prev, numero]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (numerosSelecionados.length === 0) {
      alert("Selecione pelo menos um número disponível!");
      return;
    }

    try {
      const response = await axios.post("http://localhost:3000/create-payment", {
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

    let baseStyle =
      "w-12 h-12 rounded-md font-semibold flex items-center justify-center border shadow text-sm transition";
    let estilo = "";

    if (numerosSelecionados.includes(numero)) {
      estilo = " bg-blue-600 text-white scale-105";
    } else if (status === "pago") {
      estilo = " bg-red-400 text-white cursor-not-allowed";
    } else if (status === "reservado") {
      estilo = " bg-yellow-400 text-white cursor-not-allowed";
    } else {
      estilo = " bg-green-400 hover:bg-green-500 text-white cursor-pointer";
    }

    return (
      <button
        key={numero}
        className={`${baseStyle} ${estilo}`}
        disabled={status === "pago" || status === "reservado"}
        onClick={() => toggleNumero(numero)}
        title={
          status === "pago"
            ? "Já pago"
            : status === "reservado"
            ? "Reservado"
            : "Disponível"
        }
      >
        {numero}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-tr from-indigo-100 to-blue-100 p-6 flex flex-col items-center">
      <div className="w-full max-w-4xl">
        <h1 className="text-4xl font-bold text-center text-gray-800 mb-8">
          🎟️ Rifa Premiada — Escolha seus números
        </h1>

        <div className="bg-white rounded-xl shadow-lg p-6 mb-10">
          <div className="grid grid-cols-10 gap-2 justify-center">
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
          className="bg-white shadow-xl rounded-xl p-6 space-y-4 max-w-lg mx-auto"
        >
          <h2 className="text-xl font-semibold text-center text-gray-700 mb-4">
            Preencha seus dados para reservar
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
