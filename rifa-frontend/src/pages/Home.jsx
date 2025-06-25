import React, { useEffect, useState } from "react";
import axios from "axios";
import { Toaster, toast } from "react-hot-toast";
import SkeletonNumero from "../components/SkeletonNumero";

const TOTAL_NUMEROS = 1000;

const Home = () => {
  const [numeros, setNumeros] = useState([]);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [numerosSelecionados, setNumerosSelecionados] = useState([]);
  const [linkPagamento, setLinkPagamento] = useState("");
  const [carregando, setCarregando] = useState(false);

  const alertaUsuario = (mensagem, tipo = "info") => {
    const tipos = {
      info: () => toast(mensagem),
      sucesso: () => toast.success(mensagem),
      erro: () => toast.error(mensagem),
    };
    (tipos[tipo] || tipos.info)();
  };

  useEffect(() => {
    const buscarNumeros = async () => {
      try {
        const response = await axios.get("https://rifa-project-08f5.onrender.com/numeros");
        setNumeros(response.data);
      } catch (err) {
        alertaUsuario("Erro ao carregar os números da rifa. Por favor, tente novamente em instantes.", "erro");
      }
    };
    buscarNumeros();
  }, []);

  const formatarTelefone = (valor) => {
    const apenasDigitos = valor.replace(/\D/g, "");
    if (apenasDigitos.length <= 2) return apenasDigitos;
    if (apenasDigitos.length <= 7) {
      return `(${apenasDigitos.slice(0, 2)}) ${apenasDigitos.slice(2)}`;
    }
    if (apenasDigitos.length <= 11) {
      return `(${apenasDigitos.slice(0, 2)}) ${apenasDigitos.slice(2, 7)}-${apenasDigitos.slice(7)}`;
    }
    return `(${apenasDigitos.slice(0, 2)}) ${apenasDigitos.slice(2, 7)}-${apenasDigitos.slice(7, 11)}`;
  };

  const toggleNumero = (numero) => {
    const info = numeros.find((n) => n.numero === numero.toString());
    if (info?.status === "pago") {
      alertaUsuario(`O número ${numero} já foi pago e não está mais disponível.`, "erro");
      return;
    }
    if (info?.status === "reservado") {
      alertaUsuario(`O número ${numero} está temporariamente reservado por outro participante.`, "info");
      return;
    }

    setNumerosSelecionados((prev) =>
      prev.includes(numero)
        ? prev.filter((n) => n !== numero)
        : [...prev, numero]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const telefoneSemFormatacao = telefone.replace(/\D/g, "");

    if (!nome.trim() || !telefoneSemFormatacao) {
      alertaUsuario("Por favor, preencha corretamente seu nome e número de WhatsApp.", "erro");
      return;
    }
    if (telefoneSemFormatacao.length < 10 || telefoneSemFormatacao.length > 11) {
      alertaUsuario("Informe um número de WhatsApp válido com DDD (ex: 11999999999).", "erro");
      return;
    }
    if (numerosSelecionados.length === 0) {
      alertaUsuario("Selecione ao menos um número disponível antes de gerar o pagamento.", "erro");
      return;
    }

    setCarregando(true);
    try {
      const response = await axios.post("https://rifa-project-08f5.onrender.com/create-payment", {
        nome,
        telefone: telefoneSemFormatacao,
        numeros: numerosSelecionados,
      });
      setLinkPagamento(response.data.init_point);
      alertaUsuario("Reserva realizada com sucesso! Agora finalize o pagamento.", "sucesso");
    } catch (error) {
      const mensagemErro = error.response?.data?.error || error.message;
      alertaUsuario(`Erro ao gerar o pagamento: ${mensagemErro}`, "erro");
    } finally {
      setCarregando(false);
    }
  };

  const renderNumero = (numero) => {
    const info = numeros.find((n) => n.numero === numero.toString());
    const status = info?.status;

    let bgColor = "bg-green-500 hover:bg-green-600 border border-green-600";
    if (status === "pago") bgColor = "bg-gray-300 text-gray-500 line-through cursor-not-allowed";
    else if (status === "reservado") bgColor = "bg-yellow-300 text-gray-800 cursor-not-allowed";
    else if (numerosSelecionados.includes(numero)) bgColor = "bg-blue-500 scale-110 border border-blue-700";

    return (
      <button
        key={numero}
        onClick={() => toggleNumero(numero)}
        disabled={status === "pago" || status === "reservado"}
        aria-label={`Número ${numero} - ${status}`}
        className={`w-10 h-10 md:w-12 md:h-12 text-sm font-semibold rounded-md shadow flex items-center justify-center transition transform ${bgColor}`}
        title={
          status === "pago" ? "Número já pago" :
          status === "reservado" ? "Reservado temporariamente" :
          "Clique para selecionar"
        }
      >
        {numero}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 to-blue-50 p-6">
      <Toaster position="top-center" />
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-center text-gray-800 mb-4">
          🎟️ Rifa Premiada — Escolha seus números
        </h1>
        <p className="text-center text-gray-600 mb-2">
          Cada número custa <span className="font-bold text-green-600">R$ 4,99</span>
        </p>
        <p className="text-sm text-gray-500 text-center mb-4">
          ⚠️ Números reservados ficam bloqueados por até 15 minutos.
        </p>

        <div className="bg-white p-6 rounded-2xl shadow-lg mb-10">
          <div className="grid grid-cols-5 sm:grid-cols-10 md:grid-cols-20 gap-2 justify-center">
            {numeros.length === 0
              ? Array.from({ length: 100 }, (_, i) => <SkeletonNumero key={i} />)
              : Array.from({ length: TOTAL_NUMEROS }, (_, i) => renderNumero(i + 1))}
          </div>
          {numerosSelecionados.length > 0 && (
            <p className="mt-4 text-center text-gray-700 font-medium">
              Números selecionados: {" "}
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
            Informe seus dados para gerar o pagamento
          </h2>
          <input
            type="text"
            placeholder="Nome completo"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring focus:outline-none"
          />
          <input
            type="tel"
            placeholder="WhatsApp com DDD (ex: (11) 99999-9999)"
            value={telefone}
            onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
            required
            maxLength={15}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring focus:outline-none"
          />
          <button
            type="submit"
            disabled={carregando}
            className={`w-full text-white py-3 rounded-lg transition ${
              carregando ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {carregando ? "Gerando link..." : "💸 Gerar Pagamento via PIX"}
          </button>
        </form>

        {linkPagamento && (
          <div className="text-center mt-6">
            <p className="text-green-700 mb-2 font-medium">Seu número está reservado!</p>
            <a
              href={linkPagamento}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-lg transition"
            >
              ✅ Finalizar pagamento via PIX
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
