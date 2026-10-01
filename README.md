# Atlas — Diário de treino

## Abrir

Abre `index.html` num navegador moderno (Chrome, Edge, Firefox ou Safari). Não precisas de instalar pacotes. O modo local funciona sem Internet. Para disponibilizar a sincronização opcional, mantém `cloud.js` e `supabase-config.js` na mesma pasta do HTML.

Os três treinos de demonstração aparecem no primeiro acesso, identificados como exemplos. O ficheiro `exemplos.json` permite voltar a importá-los.

## Utilização

- **Importar JSON:** escolhe ficheiros `.json`, arrasta-os para a zona de importação ou cola o texto na respetiva aba. Limite de 5 MB e 200 treinos por documento.
- **Novo treino / Editar:** configura data, foco, objetivo, duração e categoria. Adiciona blocos, exercícios, supersets, aquecimento e etapas de cardio. Para um temporizador, escreve `AMRAP` no tipo do bloco e indica a duração.
- **Durante a sessão:** marca exercícios concluídos, inicia/pausa/reinicia o temporizador, ajusta rondas e escreve notas. As rondas nunca descem abaixo de zero.
- **Histórico:** pesquisa por foco, objetivo ou data e filtra por categoria.
- **Evolução:** abre a página pelo botão da barra lateral, escolhe um exercício e consulta carga máxima, volume, repetições, distância ou duração ao longo do tempo. Podes filtrar por 30 dias, 3 meses, 6 meses ou todo o histórico. O gráfico reconhece datas `AAAA-MM-DD`, `DD/MM/AAAA` e o campo alternativo `data_treino`.
- **Sugerir treino:** o motor local analisa até aos oito treinos datados mais recentes, estima o foco menos representado e cria uma sessão ajustada ao objetivo, duração, equipamento e intensidade escolhidos. Também aceita uma lista de exercícios a evitar. A sugestão pode ser editada antes de ser adicionada ao histórico.
- **Exportar:** usa o botão de seta descendente junto a Editar. Podes exportar o treino ativo ou todos os treinos.
- **Criar PDF:** abre a janela de impressão com uma versão A4 limpa do plano ativo. No computador, escolhe **Guardar como PDF**. No telemóvel, escolhe **Imprimir** e depois **Guardar como PDF** ou a opção equivalente do sistema.
- **Eliminar:** usa o botão × do treino e confirma a eliminação.

## Formatos aceites

Um objeto de treino direto, `{ "treino": { ... } }`, uma lista de treinos ou `{ "treinos": [...] }`.

As estruturas podem conter `exercicios`, `blocos_principais` e/ou propriedades dinâmicas como `bloco_1_potencia`, `bloco_2_forca`, `bloco_3_amrap`. Supersets têm uma lista interna de `exercicios`. Aquecimento aceita uma lista, um objeto com `detalhes` e `concluido`, ou texto.

Usa JSON válido: as chaves são `carga_kg` e `duracao_minutos`, sem barras invertidas antes dos underscores. Números usam ponto decimal. Intervalos de repetições devem ser strings, por exemplo `"10-12"`.

O editor preserva os campos adicionais desconhecidos; apresenta e edita os campos de treino suportados. Ao guardar uma edição, reinicia as marcações de conclusão e o temporizador, para evitar associar progresso a exercícios removidos ou alterados.

## Cálculos e persistência

- Volume: soma de `carga_kg × repeticoes × series × rondas do grupo`. Séries/rondas omitidas valem 1. Valores zero mantêm o seu significado. É volume **prescrito**, não uma medição do trabalho realizado.
- Os gráficos usam os valores planeados nos treinos guardados. Não representam automaticamente as cargas, repetições ou rondas realmente executadas.
- Exercícios AMRAP/condicionamento e repetições não exatas são excluídos do volume. O cartão identifica o volume parcial. Não se infere peso corporal, carga por lado ou séries executadas.
- Duração: usa `duracao_total_minutos`; na sua ausência, mostra apenas a soma dos tempos explicitamente indicados em blocos, aquecimento e cardio. Não infere a duração dos exercícios de força.
- Planos, notas, rondas e marcações ficam em `localStorage`, na chave `atlas.workouts.v1`. Os temporizadores ficam em memória e reiniciam ao recarregar a página. A contagem usa o relógio real para evitar deriva quando a aba fica em segundo plano.
- A exportação JSON inclui os planos, campos adicionais, notas e rondas. As marcações da interface e o estado do temporizador não fazem parte do JSON exportado.
- No modo local, os dados ficam no navegador e origem em que abriste a aplicação. Com uma conta Supabase configurada, a sincronização opcional partilha o histórico entre dispositivos (ver abaixo). Exporta para criar uma cópia de segurança. Limpar os dados do navegador apaga a cópia local, incluindo alterações ainda não sincronizadas.
- O motor de sugestões funciona integralmente no navegador, sem API, conta ou ligação à Internet. Reutiliza apenas cargas já prescritas para exercícios com o mesmo nome e nunca aumenta automaticamente a carga. Revê sempre o plano antes de o executar.
- A persistência em URLs `file://` depende do navegador. Se estiver bloqueada, a aplicação avisa; usa um servidor local para uma origem estável. Com Python instalado, executa `python -m http.server 8080` nesta pasta e abre `http://localhost:8080`. Mantém a mesma pasta e origem para voltar ao mesmo histórico.

## Organização do código

O `index.html` contém estilos responsivos, o módulo `Core` (validação, normalização não destrutiva e métricas), os dados de exemplo, persistência local, renderização, editor e eventos da SPA. `cloud.js` acrescenta autenticação e sincronização através da API HTTPS do Supabase; `supabase-config.js` contém apenas o URL e a chave pública. Não há bibliotecas de CDN nem analytics. Sem entrar na conta, a aplicação não envia treinos ao Supabase. O suporte WebMCP é opcional e disponibiliza uma ferramenta de leitura dos planos carregados na aplicação.

## Sincronização com Supabase e GitHub Pages

### Ativar

1. No projeto Supabase, abrir **SQL Editor** e executar [supabase.sql](supabase.sql). Cria a tabela `atlas_histories`, a regra de leitura por utilizador e a função de gravação com controlo de revisão. A chave pública não pode executar esta configuração de administração.
2. Em **Authentication**, ativar email e palavra-passe. Configurar o **Site URL** e os endereços de redirecionamento permitidos com o URL do Atlas no GitHub Pages. Se a confirmação de email estiver ativa, configurar o envio de emails no Supabase conforme necessário.
3. Publicar `index.html`, `cloud.js` e `supabase-config.js` juntos na pasta servida pelo GitHub Pages. Não é necessário um servidor próprio nem um passo de compilação. O SQL é executado no Supabase, não no GitHub Pages.
4. Abrir **Conta e sincronização**, criar uma conta ou entrar numa conta de utilizador da aplicação. Esta conta é distinta do login de administração do painel Supabase. Após confirmar o email, entrar com a palavra-passe. Nunca colocar chaves secretas ou `service_role` nos ficheiros do site.
5. Para transferir os dados existentes, usar **Copiar treinos do modo local**. Os exemplos de demonstração são excluídos e identificadores já presentes não são duplicados. Os dados de origem ficam preservados. Se os treinos estiverem noutro endereço ou navegador, exportar e importar o JSON.

O projeto já tem URL e chave pública em `supabase-config.js`. Também é possível preencher a configuração no formulário. A configuração publicada no ficheiro tem prioridade ao abrir novamente a aplicação.

### Utilização e limites

- Sincroniza o histórico completo: planos, notas, rondas e marcações de exercícios. Os temporizadores em execução continuam apenas em memória.
- Guarda alterações imediatamente na cópia local da conta e tenta enviá-las após uma pequena pausa. Nas notas, o envio ocorre ao sair do campo. Consulta alterações da nuvem a cada 30 segundos com a página visível, ao regressar à página ou recuperar ligação. **Sincronizar agora** permite tentar manualmente.
- Sem Internet, uma página já aberta continua a guardar alterações localmente e tenta enviá-las quando recuperar ligação. Não existe instalação PWA nem garantia de abrir o site de raiz sem Internet.
- A sessão fica nesta aba e sobrevive a recarregamentos. Ao fechar a aba, pode ser necessário entrar novamente. A cópia local é separada por projeto e utilizador; **Sair da conta** regressa ao histórico do modo local. As cópias locais não são apagadas ao sair.
- Se dois dispositivos alterarem o histórico desde a mesma revisão, a sincronização pausa. Em **Conta e sincronização**, exportar as versões e escolher o histórico a manter. A escolha afeta o histórico completo: não há fusão automática por treino. Antes da substituição, a aplicação guarda também uma cópia de ambas as versões no armazenamento local da conta.
- Usar uma aba por conta em cada navegador. Se outra aba alterar a cópia partilhada, a aplicação bloqueia a sincronização nessa aba e pede para exportar alterações e recarregar.
- O estado apresentado indica se há alterações pendentes ou erros. Esperar por **Sincronizado** antes de abandonar uma sessão quando for importante disponibilizar as alterações noutro dispositivo.
- A exportação JSON normal continua a excluir marcações de exercícios e temporizadores, mesmo numa conta sincronizada.

### Verificação da integração

Executar `node --test tests/cloud.test.cjs` para testar com rede e armazenamento simulados: sincronização entre dispositivos, conflitos, alterações offline, respostas perdidas, escrita durante um envio, separação de contas, renovação de sessão e falha de armazenamento. Estes testes não substituem a verificação das permissões e do login no projeto Supabase real.

## Verificação

Foram verificados a sintaxe JavaScript, os três formatos, o round-trip de JSON, supersets, exclusão de AMRAP e intervalos no volume, valores zero e rejeição de estruturas inválidas. Os fluxos de importação por texto, erro de JSON, edição, criação manual, persistência, progresso e temporizador foram exercitados no navegador.

## Compatibilidade adicional de importação

Aceita exercícios como nomes em texto, blocos com um único campo exercicio e listas exercicios_por_ronda. Séries, repetições por exercício e cargas partilhadas do bloco são aplicadas aos exercícios quando estes não têm valores próprios. A carga por halter é apresentada e editável separadamente; não se assume o número de halteres para calcular o volume. Detalhes como repetições por braço também são apresentados. As variantes são convertidas internamente para listas de exercícios editáveis. Inclui treino-compativel.json, convertido a partir do ficheiro fornecido.

O campo `series` também pode ser uma lista de objetos, permitindo cargas ou repetições diferentes em cada série. Neste caso, cada série é apresentada e editada separadamente. O volume soma as prescrições individuais com carga total; cargas por halter continuam assinaladas como volume parcial.

