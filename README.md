# CyberFit — Smart Fitness / Secure Data

Prototipo académico de una plataforma de entrenamiento físico con seguimiento de actividad, análisis de movimiento en navegador y un laboratorio de gestión de riesgos de ciberseguridad.

> **Importante:** CyberFit es un prototipo académico. No es una aplicación médica, no constituye una auditoría profesional ni certifica la seguridad de un sistema.

## Qué incluye esta versión

- Landing page cinematográfica, diseño visual premium y UI responsive con acentos cyan/violeta.
- Fotografías temáticas para portada, entrenamiento, alimentación, dashboard, autenticación y laboratorio; se cargan desde CDN y requieren conexión a Internet para mostrarse.
- Tarjetas de ejercicios con imagen, tratamiento editorial y estados hover; formularios y controles conservan su estructura funcional.
- Dashboard personalizado por usuario.
- Biblioteca de 6 ejercicios con filtros.
- Cámara + MediaPipe Pose para experimentación de detección local.
- Registro persistente de sesiones de entrenamiento en MongoDB.
- Módulo de alimentación con historial diario.
- Módulo de progreso con gráficas de 30 días.
- Perfil, metas y preferencias.
- Registro/login con correo y contraseña usando bcrypt.
- Google OAuth 2.0 con selección de cuenta y vinculación mediante correo verificado.
- 2FA TOTP con QR, códigos de recuperación y rate limiting.
- Sesiones almacenadas en MongoDB mediante connect-mongo.
- Helmet, CORS, validación, rate limiting y autorización por usuario.
- Laboratorio de riesgos basado en el anteproyecto de investigación.
- Matriz de probabilidad × impacto 5×5 y plan de tratamiento visual.

## Tecnologías

Frontend: HTML5, CSS3, JavaScript vanilla, Chart.js/QR Code desde CDN y MediaPipe Pose desde CDN.

Backend: Node.js, Express, MongoDB/Mongoose, bcrypt, express-session, connect-mongo, Passport Google OAuth 2.0, Helmet, CORS, express-rate-limit, express-validator y Multer.

## Instalación

```bash
npm install
```

## Variables de entorno

Copia `.env.example` a `.env` y reemplaza todos los valores de ejemplo por credenciales propias. El archivo de ejemplo no contiene credenciales reales:

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=
SESSION_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
FRONTEND_ORIGIN=http://localhost:3000
```

Nunca subas `.env` al repositorio.

## Ejecución

```bash
npm run dev
```

Abre `http://localhost:3000`.

## Google OAuth: por qué antes funcionaba solo con tu cuenta

Eso puede ser una restricción de la configuración OAuth y no un error del código. Cuando la aplicación está en modo **Testing**, Google limita el acceso a los usuarios que aparecen como usuarios de prueba. Para ampliar el acceso hay que revisar la pantalla de consentimiento, el tipo de aplicación, el estado de publicación y las URLs autorizadas en Google Cloud.

La aplicación también conserva y usa:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`

Para local:

`http://localhost:3000/api/auth/google/callback`

## 2FA

CyberFit implementa TOTP sin guardar el código temporal. El secreto se protege en la base de datos y los códigos de recuperación se almacenan como hashes.

Flujo:

1. Perfil → Seguridad.
2. Activar 2FA.
3. Escanear el QR con una aplicación autenticadora.
4. Confirmar el código de 6 dígitos.
5. Guardar los códigos de recuperación mostrados una sola vez.

Al iniciar sesión, si 2FA está activo, la contraseña por sí sola no completa la autenticación.

En cuentas que utilizan Google, Google sigue gestionando su propia autenticación; CyberFit puede además exigir su segundo factor TOTP si el usuario lo activó.

## Endpoints principales

| Método | Ruta | Propósito |
|---|---|---|
| POST | `/api/auth/register` | Registro local |
| POST | `/api/auth/login` | Login local |
| POST | `/api/auth/2fa/verify` | Verificar segundo factor |
| GET | `/api/auth/google` | Iniciar Google OAuth |
| GET | `/api/auth/google/callback` | Callback Google |
| GET | `/api/auth/me` | Usuario actual |
| POST | `/api/auth/logout` | Cerrar sesión |
| GET | `/api/auth/security` | Estado de seguridad |
| POST | `/api/auth/2fa/setup` | Preparar TOTP |
| POST | `/api/auth/2fa/enable` | Activar TOTP |
| POST | `/api/auth/2fa/disable` | Desactivar TOTP |
| PUT | `/api/users/profile` | Perfil/metas |
| POST | `/api/users/profile-image` | Foto de perfil |
| GET | `/api/workouts/summary` | Resumen de actividad |
| GET | `/api/workouts` | Historial |
| POST | `/api/workouts` | Guardar sesión |
| GET | `/api/meals` | Alimentación |
| POST | `/api/meals` | Registrar comida |
| GET | `/api/risks` | Matriz de riesgos |
| PUT | `/api/risks/:id` | Actualizar riesgo |

## Alcance académico del laboratorio de riesgos

El módulo usa como escenario CyberFit y conserva el enfoque del anteproyecto:

- identificar activos,
- reconocer amenazas y vulnerabilidades,
- valorar probabilidad e impacto,
- priorizar riesgos,
- proponer controles,
- y construir un modelo conceptual.

Las valoraciones iniciales son **estimaciones académicas**. No representan una auditoría, pentest o certificación real.

## Seguridad implementada

- bcrypt para contraseñas.
- Sesiones server-side con MongoDB.
- Cookies HttpOnly y SameSite.
- `Secure` se activa automáticamente en producción.
- Regeneración de sesión después de autenticación exitosa.
- Rate limiting para login, registro y 2FA.
- Validación de entradas en backend.
- Protección de rutas y aislamiento por usuario.
- Google solo se vincula con correo entregado como verificado.
- Secretos de Google y MongoDB mediante `.env`.
- Límites para subida de imágenes.
- No se exponen hashes, secretos TOTP ni recovery codes después de su generación.

## Limitaciones conocidas

- Para 2FA el navegador usa `qrcodejs` desde CDN.
- Los gráficos usan Chart.js desde CDN.
- La cámara/MediaPipe necesita permisos del navegador y funciona de forma apropiada en `localhost` o HTTPS.
- Google OAuth requiere que las URLs, consentimiento y usuarios de prueba/publicación estén correctamente configurados en Google Cloud.
- El secreto TOTP se cifra en reposo con AES-256-GCM usando `TOTP_ENCRYPTION_KEY`; en un despliegue real conviene gestionar esa clave con un gestor de secretos o KMS.

## Estructura

```text
cyberfit/
├── frontend/
│   ├── css/
│   ├── js/
│   ├── index.html
│   ├── login.html
│   ├── register.html
│   ├── dashboard.html
│   ├── exercises.html
│   ├── exercise.html
│   ├── meals.html
│   ├── progress.html
│   ├── security.html
│   ├── risks.html
│   └── profile.html
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── utils/
│   └── server.js
├── .env.example
├── package.json
└── README.md
```

## Novedades v1.1 — cierre de brechas del informe (secciones 13.3 y 15)

| Limitación del informe | Mejora implementada | Control ISO/IEC 27002 |
|---|---|---|
| Sin bitácora de eventos | Modelo `AuditLog` (TTL 180 días), eventos de login, 2FA, perfil, exportación y borrado; panel «Actividad reciente» en Seguridad | 8.15 |
| Sin detección de accesos anómalos | Alerta `ALERTA_FUERZA_BRUTA` con ≥5 fallos en 15 min por IP o cuenta | 8.16 |
| Política de contraseñas mínima | Lista de contraseñas comunes, secuencias y datos del usuario (NIST 800-63B) | 5.17 |
| Límite de intentos solo por IP/proceso | Bloqueo temporal por cuenta guardado en MongoDB (5 fallos → 15 min, progresivo) | 8.5 |
| Sin protección CSRF | Token sincronizado a la sesión (`GET /api/auth/csrf`, cabecera `X-CSRF-Token`) en todas las escrituras | 8.26 |
| Carga de archivos (solo MIME) | Validación de firma real (JPG/PNG/GIF/WEBP), extensión desde lista permitida, nombre aleatorio, acceso solo del propietario | 8.26, 8.28 |
| Clave TOTP con valor por defecto | El servidor no arranca en producción sin `TOTP_ENCRYPTION_KEY` ni `SESSION_SECRET` válidos | 5.17, 8.9 |
| Recovery codes con 40 bits y SHA-256 sin sal | 64 bits y HMAC-SHA256 con sal por código (compatible con códigos antiguos) | 5.17 |
| Ley 1581: sin autorización ni derechos | Casilla de autorización en registro, `privacy.html`, exportar datos, revocar y eliminar cuenta; el registro de entrenamientos/comidas exige autorización | 5.34 |
| Pruebas básicas | 9 pruebas unitarias (`npm test`): RFC 6238, recovery codes, contraseñas, bloqueo, CSRF, firma de imágenes, entorno y aislamiento entre usuarios | 8.29 |
| Riesgos con residual 2×2 por defecto | El laboratorio carga los residuales y estados de la Tabla 12 | — |

### Pendiente (no incluido en esta versión)
- CSP activa (requiere alojar Chart.js, QRCode y MediaPipe en local en lugar de CDN).
- Copias de seguridad cifradas 3-2-1 y política de retención de datos de usuario.
- Procedimiento de respuesta a incidentes (documento).

Los usuarios que ya existían deben aceptar la política en **Privacidad** para seguir registrando entrenamientos y comidas. Los riesgos ya sembrados en cuentas existentes no se reescriben (solo cuentas nuevas).
