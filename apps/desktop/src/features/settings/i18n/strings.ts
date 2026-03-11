/**
 * Partial i18n for application preferences cycle.
 * Coverage is explicit and limited to shell, modals, and main UI labels.
 */

export type Locale = "en" | "pt";

export type StringKey = keyof typeof en;

const en = {
  // Menu
  menu_file: "File",
  menu_view: "View",
  menu_help: "Help",
  menu_new_document: "New Document",
  menu_save: "Save",
  menu_close_tab: "Close Tab",
  menu_show_explorer: "Show Explorer",
  menu_hide_explorer: "Hide Explorer",
  menu_show_chat: "Show Chat",
  menu_hide_chat: "Hide Chat",
  menu_preferences: "Preferences…",
  menu_about: "About Pair Writer",

  // About dialog
  about_title: "Pair Writer",
  about_description: "AI-assisted thinking and writing workspace.",
  about_version: "Version 0.1.0 (preview)",
  about_close: "Close",

  // Preferences modal (provisional: View → Preferences… for this cycle)
  prefs_title: "Preferences",
  prefs_theme: "Theme",
  prefs_theme_dark: "Dark (default)",
  prefs_theme_dark_blue: "Dark Blue",
  prefs_theme_dark_graphite: "Dark Graphite",
  prefs_font_preset: "Font preset",
  prefs_font_default: "Default UI",
  prefs_font_reading: "Reading",
  prefs_font_editorial: "Editorial",
  prefs_language: "Language",
  prefs_language_en: "English",
  prefs_language_pt: "Português",
  prefs_close: "Close",
  prefs_font_note: "Font preset applies to document area only.",

  // Status bar
  status_no_project: "No project",
  status_no_document: "No document",
  status_edited: "Edited",
  status_words: "words",
  status_chat_on: "Chat on",
  status_chat_off: "Chat off",

  // Explorer
  explorer_title: "Explorer",
  explorer_select_folder: "Select a project folder to browse files",
  explorer_select_btn: "Select project folder",
  explorer_change: "Change",
  explorer_new_doc: "New document",
  explorer_change_folder: "Change project folder",
  explorer_doc_name_placeholder: "Document name...",
  explorer_error_empty: "Name cannot be empty",
  explorer_error_invalid: "Name contains invalid characters",
  explorer_error_exists: "File already exists",
  explorer_error_create: "Failed to create file",
  explorer_unsupported: "File type not supported",

  // Unsaved changes dialog
  unsaved_title: "Unsaved Changes",
  unsaved_message: "Do you want to save changes to",
  unsaved_cancel: "Cancel",
  unsaved_discard: "Discard",

  // Workspace
  workspace_no_document: "No document open",

  // Editor toolbar
  toolbar_undo: "Undo",
  toolbar_redo: "Redo",
  toolbar_bold: "Bold (Cmd+B)",
  toolbar_italic: "Italic (Cmd+I)",
  toolbar_underline: "Underline",
  toolbar_code: "Inline Code (Cmd+E)",
  toolbar_h1: "Heading 1",
  toolbar_h2: "Heading 2",
  toolbar_h3: "Heading 3",
  toolbar_bullet_list: "Bullet List",
  toolbar_ordered_list: "Ordered List",
  toolbar_blockquote: "Blockquote",
  toolbar_code_block: "Code Block",
  toolbar_table: "Insert table (3x3)",

  // Chat
  chat_title: "Chat",
  chat_you: "You",
  chat_assistant: "Assistant",
  chat_placeholder: "Ask about this document...",

  // Bubble menu (evolved contextual menu on text selection)
  bubble_instruction_placeholder: "Instruction for selected text...",
  bubble_send: "Send",
  bubble_bold: "Bold (Cmd+B)",
  bubble_italic: "Italic (Cmd+I)",
  bubble_h2: "Heading 2",
  bubble_code: "Inline Code (Cmd+E)",
  bubble_refine: "Refine",
  bubble_simplify: "Simplify",
  bubble_formalize: "Formalize",
  bubble_command_prepared: "Command prepared",
} as const;

const pt: Record<StringKey, string> = {
  menu_file: "Arquivo",
  menu_view: "Exibir",
  menu_help: "Ajuda",
  menu_new_document: "Novo documento",
  menu_save: "Salvar",
  menu_close_tab: "Fechar aba",
  menu_show_explorer: "Exibir explorador",
  menu_hide_explorer: "Ocultar explorador",
  menu_show_chat: "Exibir chat",
  menu_hide_chat: "Ocultar chat",
  menu_preferences: "Preferências…",
  menu_about: "Sobre o Pair Writer",

  about_title: "Pair Writer",
  about_description: "Workspace de redação e pensamento assistido por IA.",
  about_version: "Versão 0.1.0 (visualização)",
  about_close: "Fechar",

  prefs_title: "Preferências",
  prefs_theme: "Tema",
  prefs_theme_dark: "Escuro (padrão)",
  prefs_theme_dark_blue: "Escuro azul",
  prefs_theme_dark_graphite: "Escuro grafite",
  prefs_font_preset: "Preset de fonte",
  prefs_font_default: "Padrão UI",
  prefs_font_reading: "Leitura",
  prefs_font_editorial: "Editorial",
  prefs_language: "Idioma",
  prefs_language_en: "English",
  prefs_language_pt: "Português",
  prefs_close: "Fechar",
  prefs_font_note: "O preset de fonte aplica-se apenas à área do documento.",

  status_no_project: "Sem projeto",
  status_no_document: "Sem documento",
  status_edited: "Editado",
  status_words: "palavras",
  status_chat_on: "Chat ligado",
  status_chat_off: "Chat desligado",

  explorer_title: "Explorador",
  explorer_select_folder: "Selecione uma pasta de projeto para navegar nos arquivos",
  explorer_select_btn: "Selecionar pasta de projeto",
  explorer_change: "Alterar",
  explorer_new_doc: "Novo documento",
  explorer_change_folder: "Alterar pasta de projeto",
  explorer_doc_name_placeholder: "Nome do documento...",
  explorer_error_empty: "O nome não pode estar vazio",
  explorer_error_invalid: "O nome contém caracteres inválidos",
  explorer_error_exists: "O arquivo já existe",
  explorer_error_create: "Falha ao criar arquivo",
  explorer_unsupported: "Tipo de arquivo não suportado",

  unsaved_title: "Alterações não salvas",
  unsaved_message: "Deseja salvar as alterações em",
  unsaved_cancel: "Cancelar",
  unsaved_discard: "Descartar",

  workspace_no_document: "Nenhum documento aberto",

  toolbar_undo: "Desfazer",
  toolbar_redo: "Refazer",
  toolbar_bold: "Negrito (Cmd+B)",
  toolbar_italic: "Itálico (Cmd+I)",
  toolbar_underline: "Sublinhado",
  toolbar_code: "Código inline (Cmd+E)",
  toolbar_h1: "Título 1",
  toolbar_h2: "Título 2",
  toolbar_h3: "Título 3",
  toolbar_bullet_list: "Lista com marcadores",
  toolbar_ordered_list: "Lista numerada",
  toolbar_blockquote: "Citação",
  toolbar_code_block: "Bloco de código",
  toolbar_table: "Inserir tabela (3x3)",

  chat_title: "Chat",
  chat_you: "Você",
  chat_assistant: "Assistente",
  chat_placeholder: "Pergunte sobre este documento...",

  bubble_instruction_placeholder: "Instrução para o trecho selecionado...",
  bubble_send: "Enviar",
  bubble_bold: "Negrito (Cmd+B)",
  bubble_italic: "Itálico (Cmd+I)",
  bubble_h2: "Título 2",
  bubble_code: "Código inline (Cmd+E)",
  bubble_refine: "Refinar",
  bubble_simplify: "Simplificar",
  bubble_formalize: "Formalizar",
  bubble_command_prepared: "Comando preparado",
};

export const strings: Record<Locale, Record<StringKey, string>> = { en, pt };
