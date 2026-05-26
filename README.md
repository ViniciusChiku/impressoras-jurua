# 🖨️ Mapa Juruá - Sistema de Gestão de Ativos de Impressão
### 🏥 Operação de Missão Crítica (Simpress / NTO Dasa)

O **Mapa Juruá** é uma aplicação web de alta performance e segurança projetada para monitorar, auditar e assegurar a disponibilidade contínua de toda a frota de impressoras terceirizadas pela **Simpress** dentro do **Núcleo Técnico Operacional (NTO) da Dasa** (unidade da Av. Juruá).

Em um ambiente hospitalar e de diagnóstico laboratorial, a disponibilidade do sistema de impressão é de extrema importância: atrasos nas impressões podem afetar a agilidade de laudos médicos. Este sistema centraliza o controle de ativos, simplifica a bilhetagem mensal de contadores físicos e automatiza processos complexos utilizando Inteligência Artificial de ponta.

---

## 🚀 Funcionalidades e Recursos Avançados

### 1. 🧠 Inteligência Artificial Multimodal (Gemini 2.5 Flash)
O sistema integra a API de IA Generativa do Google para revolucionar o cadastro e a movimentação de impressoras no NTO:
* **Comando por Voz e Texto (Web Speech API):** O técnico residente pode falar ou digitar comandos naturais (ex: *"Mover a impressora HP do Financeiro para a TI com o IP 192.168.1.100"*).
* **Leitura Óptica (OCR) por Câmera:** O operador pode tirar uma foto da etiqueta de patrimônio ou do relatório de contadores. A IA extrai o número de série, modelo e o contador de páginas diretamente da imagem.
* **Segurança e Isolamento de Chave:** A Gemini API Key é armazenada de forma segura em variáveis de ambiente `.env` (`REACT_APP_GEMINI_API_KEY`) e seu uso é restrito em nível de código exclusivamente para usuários autenticados como administrador.
* **Revisão Humana ("Human-in-the-Loop"):** Para garantir a integridade dos dados, a IA não altera o banco diretamente. Ela pré-preenche o formulário padrão destacando as sugestões em **violeta com um badge dinâmico ("✨ IA")**, permitindo que o técnico revise e valide tudo antes de persistir no banco.

### 2. 🔄 Troca Bidirecional Dinâmica (Cross-Swapping)
* Ao realizar a substituição de um equipamento ativo por uma impressora de backup via comando de IA, o sistema realiza uma atualização dupla (dual-write) inteligente no Firestore.
* No momento em que o formulário é salvo, a nova impressora assume o setor com seu IP de destino e a impressora anterior é **automaticamente transferida para Estoque**, tendo seu status alterado para *"Backup"* ou *"Manutenção"*, limpando as configurações antigas de IP e evitando duplicidade lógica de locais.

### 3. ♯ Gestão e Controle de Contadores Físicos
* **Campos Dedicados no Banco:** Inclusão de campos para controle de `contador` numérico e `dataContador` (data da leitura).
* **Data do Sistema por Padrão:** A data da medição de contadores é preenchida automaticamente com a **data atual do sistema** (`YYYY-MM-DD`) no formulário, minimizando cliques do operador.
* **Design Enxuto e Grid Limpo:** O painel principal exibe as informações essenciais de rede e localização de forma limpa. Os contadores e datas ficam protegidos dentro da Ficha Técnica do equipamento e são exportados de forma mapeada no relatório em Excel.

### 4. ⚖️ Conformidade com a LGPD & Minimização de Dados
* **Banner de Consentimento:** Um banner inteligente avisa sobre o uso de tokens e cookies essenciais de sessão, salvando a resposta do usuário no armazenamento local.
* **Minimização Preventiva de PII:** Alertas visuais expressivos nos campos de observação livre instruem o operador a não registrar dados de identificação pessoal de colaboradores (como nomes, telefones ou CPFs), restringindo as anotações ao escopo puramente técnico do patrimônio.
* **Canal com o DPO (Art. 18 LGPD):** Um modal detalhado com termos de privacidade e os canais oficiais de comunicação com o encarregado de proteção de dados (DPO) para direitos de retificação e acesso.

### 5. 🔒 Segurança Avançada e Regras de Servidor (Firebase Hardening)
A aplicação implementa o modelo de segurança **Zero Trust** no servidor, garantindo proteção contra bypasses e ataques XSS:
* **Firestore Rules (`firestore.rules`):** Leitura aberta para qualquer usuário autenticado (incluindo convidados), mas operações de escrita/deleção são bloqueadas no nível do banco e só são aceitas se o token JWT assinado digitalmente pelo Google coincidir com o e-mail do administrador (`vini.chiku123@gmail.com`).
* **Storage Rules (`storage.rules`):** Limita o upload de arquivos a no máximo **5MB** por arquivo e restringe os envios estritamente para formatos de imagens de contadores (`image/*`).
* **Prevenção contra XSS:** Filtro ativo contra injeções de scripts executáveis no frontend (`sanitizeUrl`) nas folhas de contadores, prevenindo exploits de roubos de sessão.

---

## 🛠️ Stack Tecnológica

* **Front-end:** React 19 (Arquitetura modular com hooks customizados) e React Router DOM v7.
* **Estilização:** TailwindCSS (Layout premium responsivo e animado) e Lucide React para ícones.
* **Banco de Dados & Armazenamento:** Firebase Firestore (Banco NoSQL em tempo real) e Firebase Storage (Nuvem de imagens).
* **Autenticação:** Firebase Auth (JWT com e-mail/senha para Admin e acessos anônimos para convidados).
* **Processamento Cognitivo:** Google Gemini 2.5 Flash API (IA Generativa Multimodal e OCR).
* **Bibliotecas Adicionais:** SheetJS (`xlsx`) para controle de planilhas e `html5-qrcode` para câmera de códigos de barras.

---

## 📦 Como Executar o Projeto Localmente

### Pré-requisitos
* Node.js instalado em sua máquina.
* Um projeto configurado no console do Firebase com Firestore, Storage e Auth ativos.
* Uma API Key gerada no Google AI Studio (Gemini).

### Passo 1: Instalar Dependências
No diretório do projeto, execute:
```bash
npm install
```

### Passo 2: Configurar Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto com suas credenciais do Firebase e a chave do Gemini:
```env
REACT_APP_FIREBASE_API_KEY=sua_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=seu_auth_domain
REACT_APP_FIREBASE_PROJECT_ID=seu_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=seu_storage_bucket
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=seu_messaging_sender_id
REACT_APP_FIREBASE_APP_ID=seu_app_id

# Configurações de Administrador e IA
REACT_APP_ADMIN_EMAIL=vini.chiku123@gmail.com
REACT_APP_GEMINI_API_KEY=sua_chave_do_google_ai_studio
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

### Passo 5: Deploy (Firebase Hosting, Storage e Firestore Rules)
```bash
npx firebase deploy
```

---

## 👨‍💻 Metodologia de Desenvolvimento
Este software foi desenvolvido aplicando **Engenharia de Software Assistida por IA**, utilizando o **Antigravity com Gemini** como parceiro de desenvolvimento. O desenvolvedor atuou como Tech Lead e arquiteto de soluções, definindo os requisitos de missão crítica, enquanto o código foi otimizado e estruturado de forma modular e escalável.
