# Projeto de Rifa Automática

## Componentes
- Frontend: React (pasta `/frontend`)
- Backend: Node.js + Express + Firebase Firestore (pasta `/backend`)
- Integração com Mercado Pago (via backend)
- Banco de dados: Firestore (Firebase)
- Pagamento: Pix via Mercado Pago

## Como executar localmente

### 1. Backend
- Crie um projeto no Firebase e gere a chave JSON do serviço (`firebaseServiceAccountKey.json`) e coloque em `/backend`.
- Instale as dependências:
```bash
cd backend
npm install
npm start
```
- O backend rodará em `http://localhost:3000`

### 2. Frontend
Configure com Vite ou CRA ou use estrutura pura:
```bash
cd frontend
# instale react, react-dom e ferramentas
npm install
# Rode o projeto
npm run dev
```

## Deploy recomendado

- Frontend: Vercel ou Netlify (pasta `/frontend`)
- Backend: Render, Fly.io ou Railway (pasta `/backend`)
- Firebase: Firestore habilitado
- Mercado Pago: gere um token de acesso e configure no `.env`

## Observações
- Números de rifa são verificados no Firebase antes de reservar.
- O backend lida com confirmação de pagamento via Webhook do Mercado Pago.
- É possível adicionar timeout para liberar números não pagos após X minutos.

