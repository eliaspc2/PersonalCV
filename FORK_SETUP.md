# Guia de fork + configuração (PersonalCV)

Este guia explica como fazer fork do projeto, publicar no teu GitHub Pages e configurar o conteúdo através do interface de manutenção.

---

## 1) Fazer fork do repositório

1. Abre o repositório original no GitHub.
2. Clica em **Fork** (canto superior direito).
3. Escolhe a tua conta e confirma.

> Se quiseres manter o teu fork atualizado com o original, podes usar o botão **Sync fork** mais tarde.

---

## 2) Ativar GitHub Pages

1. Vai a **Settings → Pages** no teu fork.
2. Em **Source**, escolhe a branch principal (ex.: `main`) e a pasta `/ (root)`.
3. Guarda. O site ficará disponível em algo como:

```text
https://<teu-username>.github.io/<nome-do-repo>/
```

---

## 3) Abrir o interface de manutenção

O editor está em:

```text
https://<teu-username>.github.io/<nome-do-repo>/config.html
```

É aqui que editas conteúdos, imagens, downloads e configurações do site.

---

## 4) Criar um GitHub PAT (para guardar alterações)

O editor grava alterações via API do GitHub, por isso precisas de um **Personal Access Token (PAT)**.

### Opção A — Fine‑grained token (recomendado)
1. Vai a **GitHub → Settings → Developer settings → Personal access tokens → Fine‑grained tokens**.
2. Cria um token novo com:
   - **Repository access**: só o teu repo
   - **Permissions (mínimo):**
     - Contents: **Read and write**
     - (Opcional) Actions/Workflows: apenas se usares workflows específicos
3. Copia o token e guarda num local seguro.

### Opção B — Classic token
1. Vai a **Personal access tokens (classic)**.
2. Cria token com scope **repo**.

> O token fica guardado **apenas no browser** (local storage). Não vai para o GitHub nem para o código.

---

## 5) OpenAI API Key (para tradução automática)

Se quiseres usar as funções automáticas de tradução, precisas de uma **OpenAI API Key**.

1. Entra na plataforma da OpenAI.
2. Vai à página **API Keys** e cria uma nova chave.
3. Copia a chave e cola no campo **OpenAI API Key** no `config.html`.

Referências oficiais:
- Onde encontrar a API key: citeturn0search4
- Boas práticas de segurança: citeturn0search3
- Requisito de telefone para a 1.ª key (se aparecer): citeturn0search6

> Nota de segurança: nunca publiques a API key no GitHub. Usa-a apenas no editor (fica no teu browser). citeturn0search3

---

## 6) Configurar o editor (config.html)

No painel **Ligação & chaves**:
- **OpenAI API Key** → necessário para traduções automáticas
- **GitHub PAT** → necessário para gravar alterações no repo
- **Repo Owner** → o teu username
- **Repo Name** → o nome do teu fork

Depois:
1. Faz alterações no editor.
2. Clica em **Guardar alterações**.
3. Espera até ~10 minutos para o GitHub Pages atualizar o site.

---

## 7) Exportar / Importar dados

No editor:
- **Website: Exportar JSON** → descarrega tudo (cv + config + i18n)
- **Website: Importar JSON** → carrega o ficheiro de volta

Isto permite backup total e recuperação rápida.

---

## 8) O que editar para ter o teu CV

Os dados vivem em:
- `data/cv.json` → conteúdo principal e estrutura
- `data/i18n/*.json` → textos por idioma
- `data/config.json` → configuração do site

No editor, podes alterar:
- textos, labels e CTA
- imagens (com recorte pelo “Ajustar enquadramento”)
- downloads e certificados
- tema (cores)

---

## Dicas rápidas

- Se algo não aparecer no site, confirma se o idioma atual tem o texto preenchido.
- Se o editor mostrar **“Dados inválidos”**, corrige o `cv.json` e volta a guardar.
- Mantém o token e a API key apenas no teu browser.

