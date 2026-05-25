# 🖨️ Mapa Juruá - Sistema de Gestão de Ativos de Impressão
### 🏥 Operação de Missão Crítica (Simpress / NTO Dasa)

O **Mapa Juruá** é uma aplicação web de alta performance desenvolvida para gerenciar, monitorar e garantir o funcionamento contínuo de toda a frota de impressoras terceirizadas pela **Simpress** dentro do **Núcleo Técnico Operacional (NTO) da Dasa** (unidade da Av. Juruá). 

Em um ambiente de diagnóstico médico laboratorial, a disponibilidade do sistema de impressão é vital: falhas podem atrasar a emissão de laudos e exames importantes. Este sistema foi desenhado para eliminar gargalos operacionais e erros humanos, centralizando o controle e histórico de todos os ativos do setor.

---

## 🚀 Principais Funcionalidades

*   **🔐 Autenticação e Controle de Acesso (RBAC):**
    *   **Modo Administrador (Técnico Residente Simpress):** Permissão completa para cadastrar, editar, excluir impressoras, além de importar/exportar dados.
    *   **Modo Convidado (Leitura):** Permite que outros colaboradores consultem a localização, status e endereços de IP das impressoras sem o risco de alterar informações críticas.
*   **📷 Scanner de Código de Barras / Números de Série integrado:**
    *   Integração direta com a câmera do dispositivo móvel através da biblioteca `html5-qrcode`. O técnico residente pode apontar a câmera do celular para o código de barras patrimonial da impressora física para encontrá-la instantaneamente no dashboard, eliminando erros humanos de digitação manual de seriais longos.
*   **📂 Gestão de Contadores Físicos via Nuvem (Firebase Storage):**
    *   Permite tirar fotos das folhas de leitura dos contadores das impressoras e fazer o upload diretamente para a nuvem. Isso facilita a auditoria mensal de bilhetagem e faturamento de leasing da Simpress.
*   **📊 Integração e Relatórios em Excel (SheetJS):**
    *   **Importação em Lote:** Permite carregar centenas de impressoras de uma vez a partir de planilhas de auditoria da Simpress.
    *   **Exportação Instantânea:** Gera relatórios em formato `.xlsx` baseados nos filtros de busca e ordenação atuais para prestação de contas.
*   **⚡ Dashboard Reativo em Tempo Real:**
    *   Utiliza a tecnologia de escuta em tempo real (`onSnapshot`) do Firebase Firestore, garantindo que qualquer alteração de status feita por um técnico seja atualizada instantaneamente em todos os monitores do NTO.

---

## 🛠️ Stack Tecnológica

*   **Front-end:** React 19 (Moderna estruturação baseada em Hooks) e React Router DOM v7.
*   **Estilização:** TailwindCSS (Layout moderno, responsivo e responsividade fluida para celulares de técnicos em campo) e Lucide React (Ícones modernos).
*   **Banco de Dados & Armazenamento:** Firebase Firestore (Banco de dados NoSQL NoSQL em tempo real) e Firebase Storage (Armazenamento na nuvem para fotos dos contadores).
*   **Autenticação:** Firebase Auth (Login de administrador via e-mail/senha e login anônimo para convidados).
*   **Leitor de Hardware:** HTML5 QR Code (Integração de câmera nativa para leitura de códigos de barras/QR).
*   **Manipulação de Arquivos:** SheetJS (`xlsx`) para exportação e importação de planilhas de dados.

---

## 📦 Como Executar o Projeto Localmente

### Pré-requisitos
*   Node.js instalado em sua máquina.
*   Um projeto configurado no console do Firebase.

### Passo 1: Instalar Dependências
No diretório do projeto, execute:
```bash
npm install
```

### Passo 2: Configurar Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto com suas credenciais do Firebase:
```env
REACT_APP_FIREBASE_API_KEY=seu_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=seu_auth_domain
REACT_APP_FIREBASE_PROJECT_ID=seu_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=seu_storage_bucket
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=seu_messaging_sender_id
REACT_APP_FIREBASE_APP_ID=seu_app_id
```

### Passo 3: Executar em Modo de Desenvolvimento
```bash
npm start
```
O projeto estará rodando localmente em [http://localhost:3000](http://localhost:3000).

### Passo 4: Build para Produção
```bash
npm run build
```

---

## 👨‍💻 Metodologia de Desenvolvimento
Este software foi desenvolvido aplicando **Engenharia de Software Assistida por IA**, utilizando o **Antigravity com Gemini** como parceiro de desenvolvimento. O desenvolvedor atuou como Tech Lead e arquiteto de soluções, definindo os requisitos de missão crítica, enquanto o código foi otimizado e estruturado de forma automatizada e revisado detalhadamente.
