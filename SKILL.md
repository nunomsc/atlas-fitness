---
name: atlas-treinos
description: Manter e evoluir o projeto Atlas, o diário de treino autónomo em HTML. Usar para alterações neste projeto ou preparação de JSON compatível com o Atlas.
---

# Atlas — Orientações para alterações

## Consultar o projeto

Ler [README.md](README.md) para conhecer a utilização, os formatos aceites, os cálculos, a persistência e a organização do código. Manter esses detalhes no README, evitando duplicá-los nesta skill. Confirmar a implementação atual em `index.html` antes de alterar comportamentos.

Para trabalhar na importação, consultar também `exemplos.json` e `treino-compativel.json` como exemplos locais.

## Implementar

- Preservar a arquitetura autónoma e o funcionamento offline, salvo pedido do utilizador. Manter português de Portugal, estilo visual e comportamento responsivo.
- Reutilizar a validação, normalização e métricas do módulo `Core`, em vez de criar regras paralelas.
- Antes de adicionar campos, procurar equivalentes no modelo e na interface. Para informação livre por treino, considerar o campo existente `treino.notas`; distinguir notas do treino, do bloco e do exercício.
- Preservar campos adicionais do JSON e compatibilidade com o histórico guardado. Se o esquema mudar, prever compatibilidade ou migração.
- Respeitar as regras de cálculo, exportação e reinício de progresso descritas no README; alterar essas regras apenas quando fizer parte do pedido.
- Escapar texto do utilizador ao inseri-lo em HTML, seguindo o mecanismo existente.

## Verificar e documentar

Escolher verificações proporcionais à alteração:

- Dados: verificar importação, edição e exportação sem perda de campos, incluindo as variantes afetadas.
- Notas: usar dois treinos distintos, recarregar e voltar a importar a exportação para confirmar persistência e associação correta.
- Interface: verificar o fluxo afetado no navegador e a apresentação em computador e telemóvel.

Usar dados de teste isolados, preservando o histórico do utilizador. Consultar o README se for necessário servir a aplicação localmente.

Atualizar o README quando mudar a utilização, os formatos ou as regras documentadas. Na entrega, indicar o comportamento implementado e as verificações realmente executadas, incluindo limitações pendentes.
