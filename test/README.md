# Auditoria de Speech-to-Text nativo (Web Speech API)

Esta carpeta contiene los tests de auditoria del STT "normal" (no AI STT).

Pipeline auditado:
1. `react-speech-recognition` / Web Speech API devuelve el transcript (interim y final)
2. `computeInterimNext` escribe el transcript tal cual durante la escucha (sin puntuacion)
3. Al cerrar el segmento: `applyClosingPunctuation` -> `addPunctuation` (solo agrega marca terminal)

Hallazgo principal: `addPunctuation` nunca inserta comas ni cambia mayusculas/minusculas.
Solo agrega `.` `?` o `!` al final. El texto sale tal cual lo devuelve el navegador,
que frecuentemente es todo minuscula y sin comas.
