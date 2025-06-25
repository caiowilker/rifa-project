// 🛠️ Área Admin React (Somente para quem tem o link)
// Aqui você poderá acessar os dados de ganhadores e sortear um número

import React, { useEffect, useState } from "react";
import axios from "axios";
import { Toaster, toast } from "react-hot-toast";

const Admin = () => {
  const [numeroGanhador, setNumeroGanhador] = useState(null);
  const [carregandoSorteio, setCarregandoSorteio] = useState(false);
  const [numeroBuscado, setNumeroBuscado] = useState("");
  const [dadosGanhador, setDadosGanhador] = useState(null);
  const [erroBusca, setErroBusca] = useState(null);

  // 🔐 Proteção por senha
  useEffect(() => {
    const senha = prompt("Área restrita. Digite a senha:");
    if (senha !== "admin123") {
      alert("Acesso negado.");
      window.location.href = "/";
    }
  }, []);

  const sortearNumero = async () => {
    setCarregandoSorteio(true);
    try {
      const res = await axios.get("https://rifa-project-08f5.onrender.com/sortear");
      setNumeroGanhador(res.data);
      toast.success("Número sorteado com sucesso!");
    } catch (err) {
      toast.error("Erro ao sortear número");
    } finally {
      setCarregandoSorteio(false);
    }
  };

  const buscarGanhador = async () => {
    setDadosGanhador(null);
    setErroBusca(null);
    try {
      const res = await axios.get(`https://rifa-project-08f5.onrender.com/ganhador/${numeroBuscado}`);
      setDadosGanhador(res.data);
    } catch (err) {
      setErroBusca("Número não encontrado ou ainda não pago.");
    }
  };

  const copiarDados = () => {
    if (!numeroGanhador) return;
    const texto = `Número: ${numeroGanhador.numero} - ${numeroGanhador.nome} (${numeroGanhador.telefone})`;
    navigator.clipboard.writeText(texto)
      .then(() => toast.success("Dados copiados com sucesso!"))
      .catch(() => toast.error("Erro ao copiar os dados."));
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <Toaster position="top-center" />
      <div className="max-w-2xl mx-auto bg-white p-6 rounded-2xl shadow-xl">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">
          🎯 Painel Administrativo da Rifa
        </h1>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-2 text-gray-700">Sortear um número</h2>
          <button
            onClick={sortearNumero}
            disabled={carregandoSorteio}
            className={`w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-medium transition ${
              carregandoSorteio ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {carregandoSorteio ? "Sorteando..." : "🎲 Sortear Número Pago"}
          </button>

          {numeroGanhador && (
            <>
              <div className="mt-4 bg-green-100 text-green-800 p-4 rounded-lg shadow">
                <p><strong>Número:</strong> {numeroGanhador.numero}</p>
                <p><strong>Nome:</strong> {numeroGanhador.nome}</p>
                <p><strong>Telefone:</strong> {numeroGanhador.telefone}</p>
              </div>
              <button
                onClick={copiarDados}
                className="mt-2 text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-1 rounded"
              >
                📋 Copiar dados do sorteado
              </button>
            </>
          )}
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2 text-gray-700">Buscar dados de um ganhador</h2>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="Digite o número"
              value={numeroBuscado}
              onChange={(e) => setNumeroBuscado(e.target.value)}
              className="flex-1 px-4 py-2 border rounded-lg"
            />
            <button
              onClick={buscarGanhador}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
            >
              Buscar
            </button>
          </div>

          {erroBusca && <p className="text-red-500">{erroBusca}</p>}

          {dadosGanhador && (
            <div className="mt-2 bg-yellow-100 text-yellow-800 p-4 rounded-lg shadow">
              <p><strong>Número:</strong> {dadosGanhador.numero}</p>
              <p><strong>Nome:</strong> {dadosGanhador.nome}</p>
              <p><strong>Telefone:</strong> {dadosGanhador.telefone}</p>
              <p><strong>Status:</strong> {dadosGanhador.status}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Admin;
