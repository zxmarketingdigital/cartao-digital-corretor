export function leadsToCsv(leads, notificationsByLead) {
  const columns = ['data', 'nome', 'email', 'whatsapp', 'intencao', 'detalhe', 'status', 'mensagem'];
  const formulaSafe = (value) => {
    const text = value == null ? '' : String(value);
    return /^[=+\-@]/.test(text) ? "'" + text : text;
  };
  const fieldValue = (lead, column) => {
    if (column === 'data') {
      const date = lead?.created_at ? new Date(lead.created_at) : null;
      return date && !Number.isNaN(date.getTime()) ? date.toISOString() : '';
    }
    if (column === 'whatsapp') return lead?.whatsapp_e164 ?? lead?.whatsapp ?? '';
    if (column === 'detalhe') return lead?.sub_intencao ?? lead?.detalhe ?? '';
    return lead?.[column] ?? '';
  };
  void notificationsByLead;
  const rows = Array.isArray(leads) ? leads : [];
  const lines = [columns.join(';')];
  for (const lead of rows) {
    lines.push(columns.map((column) => {
      const value = formulaSafe(fieldValue(lead, column));
      return '"' + value.replaceAll('"', '""') + '"';
    }).join(';'));
  }
  return '\ufeff' + lines.join('\r\n') + '\r\n';
}
