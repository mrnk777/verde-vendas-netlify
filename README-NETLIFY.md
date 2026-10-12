# Verde Vendas — versão compatível com Netlify

Esta versão adapta o projeto para ser hospedado na Netlify com:

- Frontend estático em `public/`.
- Função de servidor em `netlify/functions/api.mjs` para `/api/health` e `/api/sales`.
- Netlify Blobs para manter o histórico salvo entre publicações e compartilhado entre quem acessa o mesmo site.
- Preço fixo no servidor de R$ 750,00 por unidade.

## Importante: não basta arrastar o ZIP para publicar

A publicação manual de uma pasta HTML/CSS/JS serve apenas o frontend. Ela não empacota/implanta a função de servidor. Para que a confirmação e o histórico compartilhado funcionem, publique o projeto conectando o repositório GitHub à Netlify, para que a Netlify rode o build e implante a função.

## Publicar no seu site atual da Netlify

1. **Extraia o ZIP** no computador.
2. Crie um repositório no GitHub e envie todos os arquivos e pastas desta pasta para a raiz do repositório. A estrutura na raiz do repositório precisa conter `netlify.toml`, `package.json`, `public/` e `netlify/functions/`.
3. Entre na Netlify e abra o projeto que já está publicado.
4. Nas configurações de build/deploy, conecte o projeto ao repositório GitHub recém-criado (a opção costuma aparecer como **Link repository**, **Connect to Git** ou **Continuous deployment**).
5. Deixe o diretório-base vazio/raiz. O arquivo `netlify.toml` define:
   - Build command: `npm install`
   - Publish directory: `public`
   - Functions directory: `netlify/functions`
6. Faça um novo deploy a partir do GitHub. Aguarde a etapa de build terminar; não use somente o botão de arrastar pasta/ZIP.
7. Abra `https://SEU-SITE.netlify.app/api/health`. A resposta esperada é JSON parecido com `{"ok":true,"unitPrice":750}`.
8. Abra a página inicial e confirme uma venda de teste. Depois, abra o site em outra janela/dispositivo: a mesma venda deve aparecer no histórico.

## Como os dados são salvos

A função salva cada venda em um registro separado do Netlify Blobs, usando um identificador único, para não substituir outra venda quando duas pessoas confirmam ao mesmo tempo. O armazenamento do site persiste entre deploys. O endpoint é público e esta versão não inclui login: qualquer pessoa com o link pode consultar e registrar vendas.

## Localização dos arquivos

- `public/index.html`: página HTML.
- `public/styles.css`: estilo verde/preto.
- `public/app.js`: calculadora e interações.
- `netlify/functions/api.mjs`: API de vendas e saúde.
- `netlify.toml`: configuração de build da Netlify.

Documentação da Netlify:
- Deploy com Git: https://docs.netlify.com/deploy/create-deploys/
- Functions: https://docs.netlify.com/build/functions/configuration/
- Netlify Blobs: https://docs.netlify.com/build/data-and-storage/netlify-blobs/
