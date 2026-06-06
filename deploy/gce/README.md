# Despliegue de RescateYa en Google Compute Engine

Esta configuracion despliega RescateYa en una VM de Compute Engine usando Docker Compose:

- `frontend`: Angular compilado y servido con Nginx.
- `backend`: FastAPI en Uvicorn.
- `db`: PostgreSQL 16 con volumen persistente.
- `caddy`: proxy publico en puerto 80 (HTTP).

El proyecto GCP usado es `intense-glow-498418-f8`.

Estado del despliegue:

- VM: `rescateya-vm`
- Zona: `us-central1-a`
- Proyecto: `intense-glow-498418-f8`

## 1. Preparar Google Cloud

```bash
gcloud config set project intense-glow-498418-f8
gcloud services enable compute.googleapis.com iam.googleapis.com aiplatform.googleapis.com
```

Crear una cuenta de servicio para la VM (permite que el backend use Vertex AI/Gemini sin guardar llaves dentro del contenedor):

```bash
gcloud iam service-accounts create rescateya-gce \
  --display-name="RescateYa Compute Engine" \
  --project=intense-glow-498418-f8

gcloud projects add-iam-policy-binding intense-glow-498418-f8 \
  --member="serviceAccount:rescateya-gce@intense-glow-498418-f8.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

Crear la VM:

```bash
gcloud compute instances create rescateya-vm \
  --project=intense-glow-498418-f8 \
  --zone=us-central1-a \
  --machine-type=e2-medium \
  --image-family=debian-12 \
  --image-project=debian-cloud \
  --boot-disk-size=30GB \
  --tags=rescateya-http \
  --service-account=rescateya-gce@intense-glow-498418-f8.iam.gserviceaccount.com \
  --scopes=https://www.googleapis.com/auth/cloud-platform
```

Abrir HTTP publico:

```bash
gcloud compute firewall-rules create rescateya-allow-http \
  --project=intense-glow-498418-f8 \
  --allow=tcp:80 \
  --target-tags=rescateya-http \
  --description="Allow HTTP traffic to RescateYa"
```

Instalar Docker en la VM:

```bash
gcloud compute scp deploy/gce/bootstrap-vm.sh rescateya-vm:/tmp/bootstrap-vm.sh \
  --zone=us-central1-a --project=intense-glow-498418-f8
gcloud compute ssh rescateya-vm --zone=us-central1-a \
  --project=intense-glow-498418-f8 --command="bash /tmp/bootstrap-vm.sh"
```

## 2. Preparar GitHub Actions

Crear una cuenta de servicio para el despliegue desde GitHub Actions:

```bash
gcloud iam service-accounts create github-actions-deploy \
  --display-name="GitHub Actions Deploy" \
  --project=intense-glow-498418-f8

gcloud projects add-iam-policy-binding intense-glow-498418-f8 \
  --member="serviceAccount:github-actions-deploy@intense-glow-498418-f8.iam.gserviceaccount.com" \
  --role="roles/compute.instanceAdmin.v1"

gcloud projects add-iam-policy-binding intense-glow-498418-f8 \
  --member="serviceAccount:github-actions-deploy@intense-glow-498418-f8.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

Crear la llave JSON para GitHub Actions:

```bash
gcloud iam service-accounts keys create gcp-sa-key.json \
  --iam-account=github-actions-deploy@intense-glow-498418-f8.iam.gserviceaccount.com \
  --project=intense-glow-498418-f8
```

En GitHub, agrega estos secretos en `Settings > Secrets and variables > Actions`:

| Nombre | Valor |
| --- | --- |
| `GCP_SA_KEY` | Contenido completo de `gcp-sa-key.json` |
| `GCE_INSTANCE` | `rescateya-vm` |
| `GCE_ZONE` | `us-central1-a` |
| `POSTGRES_PASSWORD` | Password fuerte para PostgreSQL |
| `SECRET_KEY` | Clave larga para firmar JWT |
| `FIREBASE_CREDENTIALS_JSON` | JSON de Firebase Admin (opcional, para push) |

Variables opcionales:

| Nombre | Valor recomendado |
| --- | --- |
| `GOOGLE_CLOUD_LOCATION` | `us-central1` |
| `GEMINI_MODEL` | `gemini-2.5-flash` |

## 3. Ejecutar despliegue

El workflow esta en `.github/workflows/deploy-gce.yml`.

Se ejecuta automaticamente con push a `main` cuando cambian backend, frontend, despliegue o compose. Tambien puedes ejecutarlo manualmente desde `Actions > Deploy to Google Compute Engine > Run workflow`.

Obtener la IP externa de la VM:

```bash
gcloud compute instances describe rescateya-vm \
  --zone=us-central1-a \
  --project=intense-glow-498418-f8 \
  --format="get(networkInterfaces[0].accessConfigs[0].natIP)"
```

La web queda disponible en:

```text
http://IP_EXTERNA
http://IP_EXTERNA/api
http://IP_EXTERNA/docs
```

## 4. Comandos utiles en la VM

```bash
cd /opt/rescateya
sudo docker compose --env-file .env.production -f docker-compose.prod.yml ps
sudo docker compose --env-file .env.production -f docker-compose.prod.yml logs -f backend
sudo docker compose --env-file .env.production -f docker-compose.prod.yml logs -f frontend
sudo docker compose --env-file .env.production -f docker-compose.prod.yml logs -f caddy
sudo docker compose --env-file .env.production -f docker-compose.prod.yml logs -f db
```

Para ejecutar el seed demo en produccion:

```bash
cd /opt/rescateya
sudo docker compose --env-file .env.production -f docker-compose.prod.yml exec backend python seed.py
```
