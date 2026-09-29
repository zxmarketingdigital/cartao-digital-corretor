export const I18N = {
  'pt-PT': {
    locale: 'pt-PT',
    save: 'Guardar',
    share: 'Partilhar',
    phone: 'Telemóvel',
    chat: 'Fale comigo',
    privacy: 'Os dados enviados pelo chat são usados apenas para responder ao seu contacto.',
    interest: 'Interesse',
    message: 'Mensagem',
    email: 'E-mail',
    schedule: 'Agendar',
  },
  'pt-BR': {
    locale: 'pt-BR',
    save: 'Salvar',
    share: 'Compartilhar',
    phone: 'Celular',
    chat: 'Fale conosco',
    privacy: 'Os dados enviados pelo chat são usados apenas para responder ao seu contato.',
    interest: 'Interesse',
    message: 'Mensagem',
    email: 'E-mail',
    schedule: 'Agendar',
  },
};

export function labels(locale) {
  return I18N[locale] || I18N['pt-PT'];
}
