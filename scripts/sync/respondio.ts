/**
 * Lógica pura para derivar la señal "respondió" y el tiempo de respuesta del equipo
 * a partir de los mensajes de UNA conversación de Chatwoot. Sin I/O.
 */
export interface ChatwootMessage {
  message_type: 0 | 1 | 2 | 3; // 0=inbound (lead), 1=outbound (asesora/auto), 2=activity
  created_at: number;          // epoch en segundos
  private?: boolean;           // notas internas
  id?: number;                 // id del mensaje (idempotencia de plantillas_envios)
  status?: string | null;      // sent | delivered | read | failed
  is_template_replay?: boolean;// true si es un template de WhatsApp
  template_name?: string | null;
  sender_name?: string | null; // nombre del emisor (para excluir cuenta automática)
}

export interface RespondioResult {
  respondio: boolean;
  primer_outbound_at: number | null;
  primer_inbound_at: number | null;
  tiempo_primera_respuesta_seg: number | null;
}

export function deriveRespondio(messages: ChatwootMessage[]): RespondioResult {
  const visible = messages
    .filter((m) => !m.private && (m.message_type === 0 || m.message_type === 1))
    .sort((a, b) => a.created_at - b.created_at);

  const firstOutbound = visible.find((m) => m.message_type === 1) ?? null;
  const firstInbound = visible.find((m) => m.message_type === 0) ?? null;

  const primer_outbound_at = firstOutbound?.created_at ?? null;
  const primer_inbound_at = firstInbound?.created_at ?? null;

  let respondio = false;
  if (primer_inbound_at !== null) {
    if (primer_outbound_at === null) {
      // Lead escribió primero (sin outbound previo)
      respondio = true;
    } else if (primer_inbound_at < primer_outbound_at) {
      // Lead escribió antes del primer outbound → "escribió primero"
      respondio = true;
    } else {
      // Hay un outbound primero: respondio si hay un inbound POSTERIOR al primer outbound
      respondio = visible.some(
        (m) => m.message_type === 0 && m.created_at > primer_outbound_at,
      );
    }
  }

  let tiempo_primera_respuesta_seg: number | null = null;
  if (primer_inbound_at !== null) {
    const reply = visible.find(
      (m) => m.message_type === 1 && m.created_at > primer_inbound_at,
    );
    if (reply) tiempo_primera_respuesta_seg = reply.created_at - primer_inbound_at;
  }

  return { respondio, primer_outbound_at, primer_inbound_at, tiempo_primera_respuesta_seg };
}
