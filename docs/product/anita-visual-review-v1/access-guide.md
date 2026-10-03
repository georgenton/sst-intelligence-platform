# Acceso a la revisión de Anita

## Para Anita

Jorge te enviará un enlace personal de acceso al entorno de revisión. Usa el mismo correo al que llegó o para el que se generó la invitación.

1. Abre el enlace que te envió Jorge.
2. Si todavía no tienes una cuenta, elige **Crear cuenta**.
3. Elige tu propia contraseña. No uses una contraseña compartida.
4. Inicia sesión con ese mismo correo.
5. Acepta el acceso a **SST Intelligence — Revisión Anita**.
6. Comprueba que la organización activa sea la sintética y que el banner indique que los datos son sintéticos.

El enlace de invitación es personal, de un solo uso y caduca en siete días. Si no funciona, avisa a Jorge; no copies el enlace a GitHub, Notion, capturas o chats públicos.

La revisión se realiza en staging y no en producción. No cargues datos reales de personas, trabajadores o pacientes. El entorno tiene una organización sintética con dos centros activos y datos preparados para la conversación profesional.

### Qué rol usar

- **VIEWER / Solo lectura:** recomendado para una primera lectura y comentarios.
- **SST_MANAGER:** recomendado para un taller interactivo en el que necesites registrar una decisión acotada en staging.

No necesitas un rol de propietaria o administradora para revisar el producto.

## Para Jorge — preparar el acceso de Anita

Esta sección es operativa y no se entrega como instrucciones técnicas a Anita.

1. Trabaja únicamente en el **preview de staging** autorizado. No uses el dominio productivo.
2. Inicia sesión con el propietario sintético del entorno y confirma que la organización activa sea **SST Intelligence — Revisión Anita**.
3. Abre **Equipo** → **Invitar a una persona**.
4. Escribe el correo exacto de Anita cuando esté confirmado. No lo guardes en el repositorio.
5. Elige `VIEWER` para observación o `SST_MANAGER` para una validación profesional interactiva. No concedas `ORG_OWNER` ni `ORG_ADMIN` por defecto.
6. Crea la invitación, copia el enlace una sola vez y compártelo por un canal privado.
7. Confirma que la invitación tenga una vigencia de siete días y que sea de un solo uso.
8. No pegues la URL de invitación, el correo real de Anita ni un token en GitHub, Notion, la PR, una captura o un log.

La invitación real no forma parte de esta entrega. Se genera cerca de la sesión para que el correo y la vigencia sean correctos.

## Acceso temporal de Vercel para Jorge

El preview de staging puede estar protegido por Vercel. Si una persona externa recibe un 401/403, Jorge crea un enlace temporal de acceso para el despliegue exacto, lo prueba en una ventana sin sesión y lo comparte de forma privada.

- El enlace temporal no se guarda en el repositorio ni en Notion.
- El enlace se entrega junto con la invitación personal, no como una contraseña compartida.
- El enlace temporal caduca; si expira, Jorge genera uno nuevo para el mismo despliegue.
- Anita solo debe leer “Usa el enlace de revisión que Jorge te envió”. No necesita conocer Vercel, Railway, tokens ni URLs internas.

## Comprobar que se está en el entorno correcto

Antes de iniciar la sesión, verifica:

- el encabezado dice **SST Inteligente — Staging**;
- la organización dice **SST Intelligence — Revisión Anita**;
- aparece el aviso **Los datos son sintéticos**;
- no se ve una URL de producción;
- el menú permite abrir Evaluación, Plan, Cola, Inspecciones, EPP, Salud, Psicosocial y Biblioteca.

## Límites de esta entrega

No se crean invitaciones reales en esta tarea. No se escriben organizaciones reales, no se despliega producción y no se comparten contraseñas, cookies o tokens. La revisión profesional se registra aparte de cualquier publicación normativa.
