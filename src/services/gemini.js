// Serviço de Integração com Google Gemini 2.5 Flash (Multimodal)

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

/**
 * Converte um arquivo em Base64 para envio na API do Gemini
 */
export const fileToGenerativePart = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64Data = reader.result.split(',')[1];
            resolve({
                inlineData: {
                    data: base64Data,
                    mimeType: file.type
                },
            });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

/**
 * Processa um comando multimodal (Foto + Texto) utilizando a API do Gemini
 */
export const processCommandWithGemini = async (apiKey, textCommand, imageFile, currentPrinters = []) => {
    if (!apiKey) {
        throw new Error("Chave de API do Gemini não configurada.");
    }

    try {
        const contents = [];
        const parts = [];

        // Adiciona a imagem, se houver
        if (imageFile) {
            const imagePart = await fileToGenerativePart(imageFile);
            parts.push(imagePart);
        }

        // Contexto do Banco de Dados para a IA tomar decisões
        const printersContext = currentPrinters.map(p => ({
            serial: p.serial || '',
            model: p.model || '',
            ip: p.ip || '',
            location: p.location || '',
            departamento: p.departamento || '',
            status: p.status || '',
            id: p.id
        }));

        // Prompt de Instrução de Sistema Estrito
        const systemPrompt = `
Você é o assistente inteligente de inventário do aplicativo de gerenciamento de impressoras Mapa Juruá (Simpress Partner Suite).
Seu objetivo é analisar um comando em texto livre do operador (que pode ser digitado ou falado) e/ou uma foto da etiqueta de número de série ou folha de teste da impressora, e decidir se o usuário deseja realizar um cadastro (inserção) ou atualização de ativo.

CONTEXTO ATUAL DE IMPRESSORAS CADASTRADAS:
${JSON.stringify(printersContext, null, 2)}

INSTRUÇÕES DE PROCESSAMENTO:
1. Se houver uma foto, use seu OCR avançado para localizar e extrair o número de série da impressora (geralmente etiquetas com códigos de barras, contendo letras e números, ex: BRJ12345, CNB12345, etc) ou modelo da impressora.
2. Analise a instrução em texto ou voz fornecida pelo usuário: ex: "esta impressora vai para o RH", "trocar ADM por esta serie de backup", "colocar esta impressora em manutencao".
3. Identifique a intenção:
   - Se a série detectada na foto ou citada no texto já existir no CONTEXTO ATUAL, marque 'exists: true' e traga as informações existentes como base, mas modifique os campos solicitados (ex: mudar local para "RH").
   - Se a série não existir, marque 'exists: false' e tente deduzir o máximo de campos possível para um novo cadastro.
4. Se o comando for de substituição/troca (ex: "trocar impressora do TI por esta backup" ou "substituir ADM por esta"):
   - Identifique qual impressora deve sair (a que atualmente ocupa o local/departamento alvo, ex: "TI" ou "ADM") e qual deve entrar (a de backup com a série detectada ou citada).
   - O IP, Local e Departamento do ativo de saída devem ser repassados para este novo ativo de entrada.
   - Preencha o objeto 'swap' no JSON contendo as instruções para atualizar o ativo que está saindo (outgoing). Se não for um comando de substituição/troca, defina 'swap' como null.
5. Se houver uma foto de folha de contadores ou relatório e você detectar qualquer contador numérico de páginas impressas (termos como "Total de Páginas", "Impressões", "Total Pages", "Page Count", "Contador de Páginas", etc.), extraia esse valor numérico para o campo 'contador' e inicie o campo 'observacao' com "Contador detectado por IA: X páginas. " seguido das demais observações.
6. Se você não conseguir determinar o número de série de forma alguma, retorne um JSON com a propriedade "error" preenchida explicando o motivo.

Você deve responder EXCLUSIVAMENTE em formato JSON puro, sem marcações markdown ou blocos de código adicionais, seguindo rigorosamente a estrutura abaixo:
{
  "serial": "NÚMERO DE SÉRIE EXTRAÍDO OU DETECTADO (Sempre em letras maiúsculas)",
  "exists": true ou false,
  "model": "MODELO DA IMPRESSORA SUGERIDO (ex: HP LaserJet M404)",
  "location": "NOME DO LOCAL/SALA FÍSICA SUGERIDO (ex: Sala de Reunião 2)",
  "departamento": "NOME DO DEPARTAMENTO SUGERIDO (ex: TI)",
  "ip": "ENDEREÇO IP SUGERIDO (ex: 192.168.1.15 ou USB)",
  "status": "STATUS SUGERIDO (Funcionando, Defeito, Manutenção, Backup, Aguardando retirada)",
  "observacao": "Uma breve observação adicionada automaticamente explicando a alteração feita pela IA",
  "contador": "VALOR NUMÉRICO DO CONTADOR DE PÁGINAS EXTRAÍDO (ex: 34500 ou null)",
  "swap": {
    "outgoingSerial": "NÚMERO DE SÉRIE DA IMPRESSORA QUE ESTÁ SAINDO (ex: BRJ888777)",
    "status": "STATUS DA IMPRESSORA QUE ESTÁ SAINDO (geralmente Manutenção ou Backup)",
    "location": "Novo local físico para a impressora que está saindo (ex: Estoque ou Setor de Manutenção)",
    "departamento": "Novo departamento para a impressora que está saindo (ex: Estoque ou Manutenção)",
    "ip": "Novo IP para a que está saindo (geralmente USB ou vazio)",
    "observacao": "Breve justificativa da troca"
  } ou null
}

Se houver erro crítico ou impossibilidade de leitura:
{
  "error": "Mensagem clara explicando o que faltou (ex: 'Não foi possível detectar o número de série na foto. Por favor, digite ou tire uma foto mais nítida.')"
}
`;

        parts.push({
            text: `${systemPrompt}\n\nCOMANDO DO USUÁRIO: "${textCommand || 'Tratar imagem e deduzir número de série e modelo.'}"`
        });

        contents.push({ parts });

        const response = await fetch(`${BASE_URL}?key=${apiKey}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents,
                generationConfig: {
                    responseMimeType: "application/json"
                }
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || "Erro de conexão com o Gemini API.");
        }

        const resData = await response.json();
        const rawJsonText = resData.candidates[0].content.parts[0].text;
        
        // Faz o parse do JSON seguro retornado pelo Gemini
        const result = JSON.parse(rawJsonText.trim());
        return result;

    } catch (error) {
        console.error("Erro no processamento do Gemini:", error);
        throw error;
    }
};
