import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
CATALOG = json.loads((REPO / "infra/deployables.json").read_text(encoding="utf-8"))
UNRESOLVED_DIGEST = "sha256:" + ("0" * 64)

PORTS = {
    "frontend": 8080,
    "api-gateway": 8080,
    "cart-service": 8084,
    "configuration-service": 8097,
    "inventory-service": 8083,
    "invoice-service": 8098,
    "messaging-service": 8095,
    "monitoring-service-v2": 8096,
    "notification-service": 8087,
    "order-service": 8091,
    "payment-service": 8092,
    "product-service": 8082,
    "recommendations-service": 8094,
    "search-service": 8086,
    "seller-finance-service": 8090,
    "shipping-service": 8093,
    "user-service": 8081,
    "video-moderator": 8100,
    "video-transcoder": 8098,
}

GRPC_PORTS = {
    "inventory-service": 9093,
    "payment-service": 9094,
    "shipping-service": 9095,
}


def indent(lines: str, spaces: int) -> str:
    prefix = " " * spaces
    return "\n".join(prefix + line if line else line for line in lines.splitlines())


def workload_documents(item: dict) -> str:
    service_id = item["id"]
    workload = item["workload"]
    container = item["container"]
    port = PORTS[service_id]
    service_account = workload
    runtime = item["runtime"]
    if service_id == "video-moderator":
        server_variable = "MODERATOR_PORT"
    elif runtime == "node":
        server_variable = "PORT"
    else:
        server_variable = "SERVER_PORT"
    data_names: set[str] = set()
    if service_id == "frontend":
        env = ""
        env_from = ""
    else:
        data_names = {entry["name"] for entry in item["data"]}
        env_entries = [f'''        - name: {server_variable}
          value: "{port}"''']
        if service_id in {
            "api-gateway",
            "configuration-service",
            "invoice-service",
            "order-service",
            "payment-service",
            "shipping-service",
        }:
            env_entries.append('''        - name: CONFIG_SERVICE_INTERNAL_TOKEN
          valueFrom:
            secretKeyRef: {name: vnshop-runtime-secrets, key: config-service-internal-token}''')
        if "postgresql" in data_names:
            schema = service_id.replace("-service", "").replace("-", "_") + "_svc"
            if runtime == "spring":
                env_entries.append(f'''        - name: SPRING_DATASOURCE_URL
          value: "jdbc:postgresql://postgres:5432/vnshop?currentSchema={schema}"
        - name: SPRING_DATASOURCE_USERNAME
          valueFrom:
            secretKeyRef: {{name: vnshop-runtime-secrets, key: {service_id}-db-username}}
        - name: SPRING_DATASOURCE_PASSWORD
          valueFrom:
            secretKeyRef: {{name: vnshop-runtime-secrets, key: {service_id}-db-password}}''')
            elif service_id == "messaging-service":
                env_entries.append(f'''        - name: DB_HOST
          value: postgres
        - name: DB_PORT
          value: "5432"
        - name: DB_DATABASE
          value: vnshop
        - name: DB_USERNAME
          valueFrom:
            secretKeyRef: {{name: vnshop-runtime-secrets, key: {service_id}-db-username}}
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef: {{name: vnshop-runtime-secrets, key: {service_id}-db-password}}''')
            elif service_id == "video-moderator":
                env_entries.append(f'''        - name: MODERATOR_DATABASE_URL
          valueFrom:
            secretKeyRef: {{name: vnshop-runtime-secrets, key: {service_id}-database-url}}''')
            else:
                env_entries.append(f'''        - name: DATABASE_URL
          valueFrom:
            secretKeyRef: {{name: vnshop-runtime-secrets, key: {service_id}-database-url}}''')
        if "kafka" in data_names:
            if service_id == "video-moderator":
                env_entries.append(f'''        - name: MODERATOR_KAFKA_BOOTSTRAP_SERVERS
          value: kafka:9092
        - name: MODERATOR_KAFKA_SECURITY_PROTOCOL
          value: SASL_SSL
        - name: MODERATOR_KAFKA_SASL_MECHANISM
          value: PLAIN
        - name: MODERATOR_KAFKA_SSL_CA_FILE
          value: /etc/kafka/tls/ca.crt
        - name: MODERATOR_KAFKA_SSL_CERT_FILE
          value: /etc/kafka/tls/client.crt
        - name: MODERATOR_KAFKA_SSL_KEY_FILE
          value: /etc/kafka/tls/client.key
        - name: MODERATOR_KAFKA_SSL_CHECK_HOSTNAME
          value: "true"
        - name: MODERATOR_KAFKA_SASL_USERNAME
          valueFrom:
            secretKeyRef: {{name: vnshop-runtime-secrets, key: {service_id}-kafka-username}}
        - name: MODERATOR_KAFKA_SASL_PASSWORD
          valueFrom:
            secretKeyRef: {{name: vnshop-runtime-secrets, key: {service_id}-kafka-password}}''')
            else:
                env_entries.append(f'''        - name: KAFKA_SASL_USERNAME
          valueFrom:
            secretKeyRef: {{name: vnshop-runtime-secrets, key: {service_id}-kafka-username}}
        - name: KAFKA_SASL_PASSWORD
          valueFrom:
            secretKeyRef: {{name: vnshop-runtime-secrets, key: {service_id}-kafka-password}}''')
                if runtime == "spring":
                    env_entries.append(f'''        - name: KAFKA_SSL_TRUSTSTORE_LOCATION
          value: /etc/kafka/tls/ca.truststore.jks
        - name: KAFKA_SSL_KEYSTORE_LOCATION
          value: /etc/kafka/tls/client.keystore.jks
        - name: KAFKA_SSL_TRUSTSTORE_PASSWORD
          valueFrom:
            secretKeyRef: {{name: vnshop-runtime-secrets, key: {service_id}-kafka-truststore-password}}
        - name: KAFKA_SSL_KEYSTORE_PASSWORD
          valueFrom:
            secretKeyRef: {{name: vnshop-runtime-secrets, key: {service_id}-kafka-keystore-password}}''')
                elif runtime == "node":
                    env_entries.append('''        - name: KAFKA_SSL_CA_FILE
          value: /etc/kafka/tls/ca.crt
        - name: KAFKA_SSL_CERT_FILE
          value: /etc/kafka/tls/client.crt
        - name: KAFKA_SSL_KEY_FILE
          value: /etc/kafka/tls/client.key''')
        if service_id == "order-service":
            env_entries.append('''        - name: GRPC_CLIENT_PAYMENT_SERVICE_TOKEN
          valueFrom:
            secretKeyRef: {name: vnshop-runtime-secrets, key: payment-grpc-service-token}''')
            env_entries.append('''        - name: GRPC_CLIENT_INVENTORY_SERVICE_TOKEN
          valueFrom:
            secretKeyRef: {name: vnshop-runtime-secrets, key: inventory-grpc-service-token}
        - name: GRPC_CLIENT_SHIPPING_SERVICE_TOKEN
          valueFrom:
            secretKeyRef: {name: vnshop-runtime-secrets, key: shipping-grpc-service-token}
        - name: GRPC_CLIENT_TLS_CA_CERT
          value: /etc/grpc/tls/ca.crt
        - name: GRPC_CLIENT_TLS_CLIENT_CERT
          value: /etc/grpc/tls/order-client.crt
        - name: GRPC_CLIENT_TLS_CLIENT_KEY
          value: /etc/grpc/tls/order-client.key''')
        if service_id == "inventory-service":
            env_entries.append('''        - name: GRPC_SERVER_AUTH_TOKEN
          valueFrom:
            secretKeyRef: {name: vnshop-runtime-secrets, key: inventory-grpc-service-token}''')
            env_entries.append('''        - name: GRPC_SERVER_TLS_CERT_CHAIN
          value: /etc/grpc/tls/server.crt
        - name: GRPC_SERVER_TLS_PRIVATE_KEY
          value: /etc/grpc/tls/server.key
        - name: GRPC_SERVER_TLS_CLIENT_CA
          value: /etc/grpc/tls/ca.crt''')
        if service_id == "payment-service":
            env_entries.append('''        - name: GRPC_SERVER_AUTH_TOKEN
          valueFrom:
            secretKeyRef: {name: vnshop-runtime-secrets, key: payment-grpc-service-token}''')
            env_entries.append('''        - name: GRPC_SERVER_TLS_CERT_CHAIN
          value: /etc/grpc/tls/server.crt
        - name: GRPC_SERVER_TLS_PRIVATE_KEY
          value: /etc/grpc/tls/server.key
        - name: GRPC_SERVER_TLS_CLIENT_CA
          value: /etc/grpc/tls/ca.crt''')
        if service_id == "shipping-service":
            env_entries.append('''        - name: GHN_WEBHOOK_TOKEN
          valueFrom:
            secretKeyRef:
              name: vnshop-runtime-secrets
              key: ghn-webhook-token
        - name: GHTK_WEBHOOK_TOKEN
          valueFrom:
            secretKeyRef:
              name: vnshop-runtime-secrets
              key: ghtk-webhook-token''')
            env_entries.append('''        - name: GRPC_SERVER_AUTH_TOKEN
          valueFrom:
            secretKeyRef: {name: vnshop-runtime-secrets, key: shipping-grpc-service-token}''')
            env_entries.append('''        - name: GRPC_SERVER_TLS_CERT_CHAIN
          value: /etc/grpc/tls/server.crt
        - name: GRPC_SERVER_TLS_PRIVATE_KEY
          value: /etc/grpc/tls/server.key
        - name: GRPC_SERVER_TLS_CLIENT_CA
          value: /etc/grpc/tls/ca.crt''')
        if "redis" in data_names:
            if service_id == "notification-service":
                env_entries.append('''        - name: REDIS_URL
          valueFrom:
            secretKeyRef: {name: vnshop-runtime-secrets, key: notification-service-redis-url}''')
            else:
                env_entries.append('''        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef: {name: vnshop-runtime-secrets, key: platform-redis-password}''')
        if "mongodb" in data_names:
            env_entries.append(f'''        - name: MONGO_URI
          valueFrom:
            secretKeyRef: {{name: vnshop-runtime-secrets, key: {service_id}-mongodb-uri}}''')
        if "timescaledb" in data_names:
            env_entries.append('''        - name: TIMESCALE_DB
          value: monitoring
        - name: TIMESCALE_USER
          valueFrom:
            secretKeyRef: {name: vnshop-runtime-secrets, key: platform-timescale-username}
        - name: TIMESCALE_PASSWORD
          valueFrom:
            secretKeyRef: {name: vnshop-runtime-secrets, key: platform-timescale-password}''')
        if "minio" in data_names:
            access_key = f"{service_id}-minio-access-key"
            secret_key = f"{service_id}-minio-secret-key"
            if service_id == "video-moderator":
                env_entries.append(f'''        - name: MODERATOR_STORAGE_ENDPOINT
          value: http://minio:9000
        - name: MODERATOR_STORAGE_ACCESS_KEY
          valueFrom:
            secretKeyRef: {{name: vnshop-runtime-secrets, key: {access_key}}}
        - name: MODERATOR_STORAGE_SECRET_KEY
          valueFrom:
            secretKeyRef: {{name: vnshop-runtime-secrets, key: {secret_key}}}''')
            elif service_id == "video-transcoder":
                env_entries.append(f'''        - name: S3_ENDPOINT
          value: http://minio:9000
        - name: S3_REGION
          value: auto
        - name: S3_ACCESS_KEY
          valueFrom:
            secretKeyRef: {{name: vnshop-runtime-secrets, key: {access_key}}}
        - name: S3_SECRET_KEY
          valueFrom:
            secretKeyRef: {{name: vnshop-runtime-secrets, key: {secret_key}}}''')
            else:
                prefix = "VNSHOP_OBJECT_STORAGE" if service_id == "product-service" else "VNSHOP_USER_STORAGE"
                bucket = "vnshop-products" if service_id == "product-service" else "vnshop-avatars"
                env_entries.append(f'''        - name: {prefix}_ENABLED
          value: "true"
        - name: {prefix}_PROFILE
          value: MINIO
        - name: {prefix}_ENDPOINT
          value: http://minio:9000
        - name: {prefix}_BUCKET
          value: {bucket}
        - name: {prefix}_REGION
          value: auto
        - name: {prefix}_PATH_STYLE_ACCESS
          value: "true"
        - name: {prefix}_ACCESS_KEY
          valueFrom:
            secretKeyRef: {{name: vnshop-runtime-secrets, key: {access_key}}}
        - name: {prefix}_SECRET_KEY
          valueFrom:
            secretKeyRef: {{name: vnshop-runtime-secrets, key: {secret_key}}}''')
        if service_id == "search-service":
            env_entries.append('''        - name: ELASTICSEARCH_HOST
          value: elasticsearch
        - name: ELASTICSEARCH_PORT
          value: "9200"
        - name: ELASTICSEARCH_URL
          value: https://elasticsearch:9200
        - name: ELASTICSEARCH_USERNAME
          valueFrom:
            secretKeyRef: {name: vnshop-runtime-secrets, key: search-service-elasticsearch-username}
        - name: ELASTICSEARCH_PASSWORD
          valueFrom:
            secretKeyRef: {name: vnshop-runtime-secrets, key: search-service-elasticsearch-password}
        - name: ELASTICSEARCH_CA_CERTIFICATE
          value: /etc/elasticsearch/tls/ca.crt
        - name: ELASTICSEARCH_SSL_BUNDLE
          value: elasticsearch''')
        if service_id == "user-service":
            env_entries.append('''        - name: KEYCLOAK_ADMIN_CLIENT_SECRET
          valueFrom:
            secretKeyRef: {name: vnshop-runtime-secrets, key: keycloak-admin-client-secret}''')
        env = "        env:\n" + "\n".join(env_entries) + "\n"
        env_from = '''        envFrom:
        - configMapRef:
            name: vnshop-app-config
'''
    ports = f'''        ports:
        - name: http
          containerPort: {port}
'''
    service_ports = f'''  - name: http
    port: {port}
    targetPort: http
'''
    if service_id in GRPC_PORTS:
        grpc_port = GRPC_PORTS[service_id]
        ports += f'''        - name: grpc
          containerPort: {grpc_port}
'''
        service_ports += f'''  - name: grpc
    port: {grpc_port}
    targetPort: grpc
'''
    scratch_limit = "4Gi" if service_id in {"video-moderator", "video-transcoder"} else "256Mi"
    tmp_mount = '''        volumeMounts:
        - name: scratch
          mountPath: /tmp
'''
    tmp_volume = f'''      volumes:
      - name: scratch
        emptyDir:
          medium: Memory
          sizeLimit: {scratch_limit}
'''
    tls_mount = ""
    tls_volume = ""
    if "kafka" in data_names:
        if service_id == "video-moderator":
            tls_mount = '''        - name: kafka-client-tls
          mountPath: /etc/kafka/tls
          readOnly: true
'''
            tls_volume = '''      - name: kafka-client-tls
        secret:
          secretName: vnshop-runtime-secrets
          items:
          - {key: video-moderator-kafka-ca, path: ca.crt}
          - {key: video-moderator-kafka-client-cert, path: client.crt}
          - {key: video-moderator-kafka-client-key, path: client.key}
'''
        elif runtime == "spring":
            tls_mount = '''        - name: kafka-tls
          mountPath: /etc/kafka/tls
          readOnly: true
'''
            tls_volume = f'''      - name: kafka-tls
        secret:
          secretName: vnshop-runtime-secrets
          items:
          - {{key: {service_id}-kafka-truststore, path: ca.truststore.jks}}
          - {{key: {service_id}-kafka-keystore, path: client.keystore.jks}}
'''
        elif runtime == "node":
            tls_mount = '''        - name: kafka-tls
          mountPath: /etc/kafka/tls
          readOnly: true
'''
            tls_volume = f'''      - name: kafka-tls
        secret:
          secretName: vnshop-runtime-secrets
          items:
          - {{key: {service_id}-kafka-ca, path: ca.crt}}
          - {{key: {service_id}-kafka-client-cert, path: client.crt}}
          - {{key: {service_id}-kafka-client-key, path: client.key}}
'''
    elasticsearch_mount = ""
    elasticsearch_volume = ""
    if service_id == "search-service":
        elasticsearch_mount = '''        - name: elasticsearch-ca
          mountPath: /etc/elasticsearch/tls
          readOnly: true
'''
        elasticsearch_volume = '''      - name: elasticsearch-ca
        secret:
          secretName: elasticsearch-http-transport-tls
          items:
          - key: ca.crt
            path: ca.crt
'''
    if service_id in {"inventory-service", "payment-service", "shipping-service"}:
        grpc_service = service_id.removesuffix("-service")
        tls_mount += '''        - name: grpc-tls
          mountPath: /etc/grpc/tls
          readOnly: true
'''
        tls_volume += f'''      - name: grpc-tls
        secret:
          secretName: vnshop-runtime-secrets
          items:
          - {{key: grpc-ca-cert, path: ca.crt}}
          - {{key: {grpc_service}-grpc-server-cert, path: server.crt}}
          - {{key: {grpc_service}-grpc-server-key, path: server.key}}
'''
    if service_id == "order-service":
        tls_mount += '''        - name: grpc-tls
          mountPath: /etc/grpc/tls
          readOnly: true
'''
        tls_volume += '''      - name: grpc-tls
        secret:
          secretName: vnshop-runtime-secrets
          items:
          - {key: grpc-ca-cert, path: ca.crt}
          - {key: order-grpc-client-cert, path: order-client.crt}
          - {key: order-grpc-client-key, path: order-client.key}
'''
    tmp_mount += tls_mount + elasticsearch_mount
    tmp_volume += tls_volume + elasticsearch_volume
    if service_id == "frontend":
        run_as_user = 101
    elif service_id == "video-moderator":
        run_as_user = 65532
    else:
        run_as_user = 10001
    readiness = item["probe"]["readiness"]
    liveness = item["probe"]["liveness"]
    image = item["image"] + "@" + UNRESOLVED_DIGEST
    return f'''---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: {service_account}
  annotations:
    argocd.argoproj.io/sync-wave: "-20"
automountServiceAccountToken: false
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {workload}
  annotations:
    argocd.argoproj.io/sync-wave: "0"
    vnshop.io/release-lock-required: "true"
  labels:
    app.kubernetes.io/name: {workload}
    app.kubernetes.io/part-of: vnshop
    vnshop.io/artifact-id: {service_id}
spec:
  replicas: 2
  selector:
    matchLabels:
      app.kubernetes.io/name: {workload}
  template:
    metadata:
      labels:
        app.kubernetes.io/name: {workload}
        app.kubernetes.io/part-of: vnshop
        vnshop.io/artifact-id: {service_id}
    spec:
      serviceAccountName: {service_account}
      automountServiceAccountToken: false
      securityContext:
        runAsNonRoot: true
        runAsUser: {run_as_user}
        runAsGroup: {run_as_user}
        fsGroup: {run_as_user}
        seccompProfile:
          type: RuntimeDefault
      containers:
      - name: {container}
        image: {image}
        imagePullPolicy: IfNotPresent
{ports}{env}{env_from}        readinessProbe:
          httpGet:
            path: {readiness}
            port: http
          periodSeconds: 10
          timeoutSeconds: 3
          failureThreshold: 6
        livenessProbe:
          httpGet:
            path: {liveness}
            port: http
          periodSeconds: 20
          timeoutSeconds: 3
          failureThreshold: 3
        startupProbe:
          httpGet:
            path: {liveness}
            port: http
          periodSeconds: 10
          timeoutSeconds: 3
          failureThreshold: 30
        resources:
          requests:
            cpu: 100m
            memory: 256Mi
          limits:
            cpu: 1
            memory: 1Gi
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop: ["ALL"]
{tmp_mount}{tmp_volume}---
apiVersion: v1
kind: Service
metadata:
  name: {service_id}
  annotations:
    argocd.argoproj.io/sync-wave: "0"
spec:
  type: ClusterIP
  selector:
    app.kubernetes.io/name: {workload}
  ports:
{service_ports}---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {workload}
  annotations:
    argocd.argoproj.io/sync-wave: "0"
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {workload}
  minReplicas: 2
  maxReplicas: 6
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: {workload}
  annotations:
    argocd.argoproj.io/sync-wave: "0"
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: {workload}
'''


def load_digests(env: str) -> dict[str, str]:
    lock_path = REPO / "infra/release/locks" / f"{env}.json"
    if not lock_path.exists():
        return {item["id"]: UNRESOLVED_DIGEST for item in CATALOG["deployables"]}
    lock = json.loads(lock_path.read_text(encoding="utf-8"))
    return {artifact["id"]: artifact["digest"] for artifact in lock.get("artifacts", [])}


def overlay(env: str, namespace: str, replicas: int, max_replicas: int) -> str:
    replica_entries = "\n".join(
        f'- name: {item["workload"]}\n  count: {replicas}' for item in CATALOG["deployables"]
    )
    hpa_patches = "\n".join(
        f'''- target:
    kind: HorizontalPodAutoscaler
    name: {item["workload"]}
  patch: |-
    - op: replace
      path: /spec/maxReplicas
      value: {max_replicas}'''
        for item in CATALOG["deployables"]
    )
    ingress_resource = "- ingress.yaml\n" if env in {"staging", "prod"} else ""
    keycloak_patch = "- path: keycloak-import-patch.yaml\n" if env in {"staging", "prod"} else ""
    istio_patch = '''- target:
    kind: PeerAuthentication
    name: default
  patch: |-
    - op: add
      path: /metadata/labels
      value:
        vnshop.io/transport-security: strict-mtls
''' if env == "prod" else ""
    keycloak_resources = "- keycloak-reconcile-job.yaml\n" if env in {"staging", "prod"} else ""
    realm_filename = "vnshop-realm-prod.json" if env == "prod" else "vnshop-realm.json"
    keycloak_generator = f'''configMapGenerator:
- name: vnshop-keycloak-realm
  files:
  - {realm_filename}
  options:
    annotations:
      argocd.argoproj.io/sync-wave: "-20"
generatorOptions:
  disableNameSuffixHash: true
''' if env in {"staging", "prod"} else ""
    keycloak_generator_block = f"{keycloak_generator}\n" if keycloak_generator else ""
    digests = load_digests(env)
    image_entries = "\n".join(
        f'''- name: {item["image"]}
  newName: {item["image"]}
  digest: {digests.get(item["id"], UNRESOLVED_DIGEST)}'''
        for item in CATALOG["deployables"]
    )
    return f'''apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: {namespace}
resources:
- ../../base
- namespace.yaml
{ingress_resource}{keycloak_resources}replicas:
{replica_entries}
images:
{image_entries}
{keycloak_generator_block}patches:
- path: configmap-env.yaml
{keycloak_patch}{istio_patch}{hpa_patches}
'''


def keycloak_import_patch() -> str:
    return '''apiVersion: apps/v1
kind: Deployment
metadata:
  name: keycloak
spec:
  template:
    spec:
      containers:
      - name: keycloak
        args: [start, --http-enabled=true, --proxy-headers=xforwarded, --import-realm]
        env:
        - name: GATEWAY_OAUTH2_CLIENT_SECRET
          valueFrom: {secretKeyRef: {name: vnshop-runtime-secrets, key: gateway-oauth2-client-secret}}
        volumeMounts:
        - name: realm
          mountPath: /opt/keycloak/data/import
          readOnly: true
      volumes:
      - name: realm
        configMap:
          name: vnshop-keycloak-realm
'''


def keycloak_reconcile_job() -> str:
    return '''apiVersion: batch/v1
kind: Job
metadata:
  name: vnshop-keycloak-reconcile
  labels:
    app.kubernetes.io/name: keycloak-reconcile
    app.kubernetes.io/part-of: vnshop
  annotations:
    argocd.argoproj.io/hook: Sync
    argocd.argoproj.io/sync-wave: "-5"
    argocd.argoproj.io/hook-delete-policy: BeforeHookCreation,HookSucceeded
spec:
  backoffLimit: 6
  activeDeadlineSeconds: 900
  template:
    metadata:
      labels:
        app.kubernetes.io/name: keycloak-reconcile
        app.kubernetes.io/part-of: vnshop
    spec:
      restartPolicy: OnFailure
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        runAsGroup: 1000
        fsGroup: 1000
        seccompProfile:
          type: RuntimeDefault
      containers:
      - name: keycloak-reconcile
        image: quay.io/keycloak/keycloak@sha256:0aae0de7fca85525f727d3354df17896092de8bb26ae4c12d89c77e5df8cbce4
        command: [sh, -ec]
        args:
        - |
          export HOME=/home/keycloak
          until /opt/keycloak/bin/kcadm.sh config credentials --server http://keycloak:8080 --realm master --user "$KC_BOOTSTRAP_ADMIN_USERNAME" --password "$KC_BOOTSTRAP_ADMIN_PASSWORD"; do sleep 5; done
          client_id=$(/opt/keycloak/bin/kcadm.sh get clients -r vnshop -q clientId=vnshop-monitoring --fields id --format csv --noquotes)
          if [ -z "$client_id" ]; then
            client_id=$(/opt/keycloak/bin/kcadm.sh create clients -r vnshop -s clientId=vnshop-monitoring -s name='VNShop Monitoring Dashboard' -s protocol=openid-connect -s publicClient=true -s standardFlowEnabled=true -s enabled=true -s 'attributes={"pkce.code.challenge.method":"S256"}' -i)
          fi
          /opt/keycloak/bin/kcadm.sh update clients/$client_id -r vnshop -s redirectUris='["'"$AUTH_ORIGIN"'/monitoring/"]' -s webOrigins='["'"$AUTH_ORIGIN"'"]' -s publicClient=true -s standardFlowEnabled=true -s 'attributes={"pkce.code.challenge.method":"S256"}'
          admin_role_id=$(/opt/keycloak/bin/kcadm.sh get roles/ADMIN -r vnshop --fields id --format csv --noquotes)
          if ! /opt/keycloak/bin/kcadm.sh get clients/$client_id/scope-mappings/realm -r vnshop --fields name --format csv --noquotes | grep -qx ADMIN; then
            printf '[{"id":"%s","name":"ADMIN"}]' "$admin_role_id" > /home/keycloak/admin-role.json
            /opt/keycloak/bin/kcadm.sh create clients/$client_id/scope-mappings/realm -r vnshop -f /home/keycloak/admin-role.json
          fi
          for target in vnshop-gateway vnshop-web vnshop-api; do
            target_id=$(/opt/keycloak/bin/kcadm.sh get clients -r vnshop -q clientId="$target" --fields id --format csv --noquotes)
            if [ -n "$target_id" ]; then
              case "$target" in
                vnshop-gateway) /opt/keycloak/bin/kcadm.sh update clients/$target_id -r vnshop -s redirectUris='["'"$WEB_ORIGIN"'/login/oauth2/code/vnshop-gateway","'"$AUTH_ORIGIN"'/login/oauth2/code/vnshop-gateway"]' -s webOrigins='["'"$WEB_ORIGIN"'","'"$AUTH_ORIGIN"'"]' ;;
                vnshop-web) /opt/keycloak/bin/kcadm.sh update clients/$target_id -r vnshop -s redirectUris='["'"$WEB_ORIGIN"'/*]' -s webOrigins='["'"$WEB_ORIGIN"'"]' ;;
                vnshop-api) /opt/keycloak/bin/kcadm.sh update clients/$target_id -r vnshop -s redirectUris='["'"$AUTH_ORIGIN"'/*]' -s webOrigins='["'"$AUTH_ORIGIN"'"]' ;;
              esac
            fi
          done
          /opt/keycloak/bin/kcadm.sh update realms/vnshop -s enabled=true
        env:
        - name: KC_BOOTSTRAP_ADMIN_USERNAME
          valueFrom: {secretKeyRef: {name: vnshop-runtime-secrets, key: keycloak-admin-username}}
        - name: KC_BOOTSTRAP_ADMIN_PASSWORD
          valueFrom: {secretKeyRef: {name: vnshop-runtime-secrets, key: keycloak-admin-password}}
        - name: GATEWAY_OAUTH2_CLIENT_SECRET
          valueFrom: {secretKeyRef: {name: vnshop-runtime-secrets, key: gateway-oauth2-client-secret}}
        envFrom:
        - configMapRef: {name: vnshop-app-config}
        volumeMounts:
        - name: kcadm-home
          mountPath: /home/keycloak
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop: [ALL]
      volumes:
      - name: kcadm-home
        emptyDir: {}
'''


def namespace(env: str, name: str) -> str:
    return f'''apiVersion: v1
kind: Namespace
metadata:
  name: {name}
  annotations:
    argocd.argoproj.io/sync-wave: "-20"
  labels:
    app.kubernetes.io/part-of: vnshop
    environment: {env}
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
'''


def ingress(env: str) -> str:
    suffix = "vnshop.invalid" if env == "staging" else "vnshop.example"
    issuer = "vnshop-ci-root" if env == "staging" else "letsencrypt-prod"
    return f'''apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: vnshop
  annotations:
    argocd.argoproj.io/sync-wave: "10"
    cert-manager.io/cluster-issuer: {issuer}
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
  - hosts: [web.{suffix}, api.{suffix}, storage.{suffix}]
    secretName: vnshop-tls
  rules:
  - host: web.{suffix}
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 8080
  - host: api.{suffix}
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-gateway
            port:
              number: 8080
  - host: storage.{suffix}
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: minio
            port:
              number: 9000
'''


def migration_job() -> str:
    postgres_items = [
        item for item in CATALOG["deployables"]
        if any(entry["name"] == "postgresql" for entry in item["data"])
    ]
    env_lines = []
    calls = []
    ownership_calls = []
    for item in postgres_items:
        variable = item["id"].upper().replace("-", "_")
        schema = item["id"].replace("-service", "").replace("-", "_") + "_svc"
        env_lines.append(f'''        - name: {variable}_DB_USERNAME
          valueFrom:
            secretKeyRef: {{name: vnshop-runtime-secrets, key: {item["id"]}-db-username}}
        - name: {variable}_DB_PASSWORD
          valueFrom:
            secretKeyRef: {{name: vnshop-runtime-secrets, key: {item["id"]}-db-password}}''')
        calls.append(f'create_role_and_schema "${{{variable}_DB_USERNAME}}" "${{{variable}_DB_PASSWORD}}" "{schema}"')
        if item["id"] in {"cart-service", "messaging-service"}:
            ownership_calls.append(f'own_schema_objects "${{{variable}_DB_USERNAME}}" "{schema}"')
    env_lines.append('''        - name: KEYCLOAK_DB_USERNAME
          valueFrom:
            secretKeyRef: {name: vnshop-runtime-secrets, key: keycloak-db-username}
        - name: KEYCLOAK_DB_PASSWORD
          valueFrom:
            secretKeyRef: {name: vnshop-runtime-secrets, key: keycloak-db-password}''')
    calls.append('create_role_and_schema "$KEYCLOAK_DB_USERNAME" "$KEYCLOAK_DB_PASSWORD" "keycloak"')
    cart_sql = '''CREATE TABLE IF NOT EXISTS cart_svc.carts (
  user_id VARCHAR(255) PRIMARY KEY,
  items JSONB NOT NULL DEFAULT '{"userId":"","items":[],"updatedAt":"1970-01-01T00:00:00.000Z"}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1
);'''
    messaging_sql = (
        REPO / "services/messaging-service/src/db/migration/V1__messaging_schema.sql"
    ).read_text(encoding="utf-8").strip()
    node_schema_sql = cart_sql + "\n\n" + messaging_sql
    return f'''apiVersion: v1
kind: ServiceAccount
metadata:
  name: vnshop-migrations
  annotations: {{argocd.argoproj.io/sync-wave: "-20"}}
automountServiceAccountToken: false
---
apiVersion: batch/v1
kind: Job
metadata:
  name: vnshop-database-principals
  annotations:
    argocd.argoproj.io/hook: Sync
    argocd.argoproj.io/sync-wave: "-10"
    argocd.argoproj.io/hook-delete-policy: BeforeHookCreation,HookSucceeded
spec:
  backoffLimit: 6
  activeDeadlineSeconds: 900
  template:
    metadata:
      labels: {{app.kubernetes.io/name: vnshop-database-principals, app.kubernetes.io/part-of: vnshop}}
    spec:
      restartPolicy: OnFailure
      serviceAccountName: vnshop-migrations
      automountServiceAccountToken: false
      securityContext: {{runAsNonRoot: true, runAsUser: 999, runAsGroup: 999, fsGroup: 999, seccompProfile: {{type: RuntimeDefault}}}}
      containers:
      - name: migrate
        image: postgres@sha256:2a0d0fe14825b0939f78a8cad5cd4e6aa68bf94d0e5dd96e24b6d23af4315545
        command: [sh, -ec]
        args:
        - |
          create_role_and_schema() {{
            role="$1"
            password="$2"
            schema="$3"
            psql -v ON_ERROR_STOP=1 -v role="$role" -v password="$password" -v schema="$schema" <<'SQL'
          SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'role', :'password')
          WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'role') \gexec
          SELECT format('ALTER ROLE %I PASSWORD %L', :'role', :'password') \gexec
          SELECT format('CREATE SCHEMA IF NOT EXISTS %I AUTHORIZATION %I', :'schema', :'role') \gexec
          SELECT format('GRANT ALL ON SCHEMA %I TO %I', :'schema', :'role') \gexec
          SQL
          }}
          own_schema_objects() {{
            role="$1"
            schema="$2"
            psql -v ON_ERROR_STOP=1 -v role="$role" -v schema="$schema" <<'SQL'
          SELECT format('ALTER TABLE %I.%I OWNER TO %I', schemaname, tablename, :'role')
          FROM pg_tables WHERE schemaname = :'schema' \gexec
          SELECT format('ALTER SEQUENCE %I.%I OWNER TO %I', sequence_schema, sequence_name, :'role')
          FROM information_schema.sequences WHERE sequence_schema = :'schema' \gexec
          SELECT format('GRANT ALL ON ALL TABLES IN SCHEMA %I TO %I', :'schema', :'role') \gexec
          SELECT format('GRANT ALL ON ALL SEQUENCES IN SCHEMA %I TO %I', :'schema', :'role') \gexec
          SQL
          }}
          {indent(chr(10).join(calls), 10).lstrip()}
          psql -v ON_ERROR_STOP=1 <<'SQL'
          {indent(node_schema_sql, 10).lstrip()}
          SQL
          {indent(chr(10).join(ownership_calls), 10).lstrip()}
        env:
        - {{name: PGHOST, value: postgres}}
        - {{name: PGPORT, value: "5432"}}
        - {{name: PGDATABASE, value: vnshop}}
        - name: PGUSER
          valueFrom:
            secretKeyRef: {{name: vnshop-runtime-secrets, key: platform-postgres-admin-username}}
        - name: PGPASSWORD
          valueFrom:
            secretKeyRef: {{name: vnshop-runtime-secrets, key: platform-postgres-admin-password}}
{chr(10).join(env_lines)}
        resources:
          requests: {{cpu: 25m, memory: 64Mi}}
          limits: {{cpu: 250m, memory: 256Mi}}
        securityContext: {{allowPrivilegeEscalation: false, readOnlyRootFilesystem: true, capabilities: {{drop: [ALL]}}}}
        volumeMounts: [{{name: tmp, mountPath: /tmp}}]
      volumes:
      - name: tmp
        emptyDir: {{}}
'''


def monitoring_manifest() -> str:
    targets = []
    for item in CATALOG["deployables"]:
        target = f'http://{item["id"]}:{PORTS[item["id"]]}{item["probe"]["readiness"]}'
        targets.append(f'''      - targets: ["{target}"]
        labels: {{artifact_id: "{item["id"]}"}}''')
    static_targets = "\n".join(targets)
    return f'''apiVersion: v1
kind: ConfigMap
metadata:
  name: vnshop-monitoring-config
  annotations: {{argocd.argoproj.io/sync-wave: "5"}}
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      evaluation_interval: 15s
      external_labels:
        platform: vnshop-portfolio
    rule_files: [/etc/prometheus/rules/*.yml]
    alerting:
      alertmanagers:
      - static_configs:
        - targets: [alertmanager:9093]
    scrape_configs:
    - job_name: prometheus
      static_configs:
      - targets: [localhost:9090]
    - job_name: vnshop-readiness
      metrics_path: /probe
      params: {{module: [http_2xx]}}
      static_configs:
{indent(static_targets, 6)}
      relabel_configs:
      - source_labels: [__address__]
        target_label: __param_target
      - source_labels: [__param_target]
        target_label: instance
      - target_label: __address__
        replacement: blackbox-exporter:9115
    - job_name: vnshop-backup
      static_configs:
      - targets: [prometheus-pushgateway:9091]
  alerts.yml: |
    groups:
    - name: vnshop-portfolio-slo
      rules:
      - alert: VNShopArtifactUnavailable
        expr: probe_success{{job="vnshop-readiness"}} == 0
        for: 2m
        labels: {{severity: critical, owner: operations}}
        annotations:
          summary: "{{{{ $labels.artifact_id }}}} readiness failed"
          description: "{{{{ $labels.instance }}}} has failed the locked readiness path for two minutes."
      - alert: VNShopAvailabilityFastBurn
        expr: (1 - avg_over_time(probe_success{{job="vnshop-readiness"}}[1h])) > 0.144
        for: 2m
        labels: {{severity: critical, owner: operations}}
        annotations:
          summary: "{{{{ $labels.artifact_id }}}} is burning the 99.0% availability budget quickly"
      - alert: VNShopAvailabilitySlowBurn
        expr: (1 - avg_over_time(probe_success{{job="vnshop-readiness"}}[3d])) > 0.03
        for: 15m
        labels: {{severity: warning, owner: operations}}
        annotations:
          summary: "{{{{ $labels.artifact_id }}}} is burning the 99.0% availability budget"
      - alert: VNShopAvailabilitySLOBreach
        expr: avg_over_time(probe_success{{job="vnshop-readiness"}}[30d]) < 0.99
        for: 15m
        labels: {{severity: warning, owner: operations}}
        annotations:
          summary: "{{{{ $labels.artifact_id }}}} is below the 99.0% rolling availability objective"
      - alert: VNShopBackupTelemetryMissing
        expr: absent(vnshop_backup_last_success_timestamp_seconds)
        for: 30m
        labels: {{severity: critical, owner: operations}}
        annotations: {{summary: "No successful authoritative backup has been recorded"}}
      - alert: VNShopBackupRPOAtRisk
        expr: time() - vnshop_backup_last_success_timestamp_seconds > 86400
        for: 5m
        labels: {{severity: critical, owner: operations}}
        annotations: {{summary: "The latest authoritative backup is older than the 24 hour RPO"}}
  blackbox.yml: |
    modules:
      http_2xx:
        prober: http
        timeout: 5s
        http:
          method: GET
          preferred_ip_protocol: ip4
  alertmanager.yml: |
    global:
      resolve_timeout: 5m
    route:
      receiver: operations-webhook
      group_by: [alertname, artifact_id]
      group_wait: 10s
      group_interval: 5m
      repeat_interval: 3h
      routes:
      - matchers: ['severity="critical"']
        receiver: operations-webhook
        repeat_interval: 15m
    receivers:
    - name: operations-webhook
      webhook_configs:
      - url_file: /etc/alertmanager/secrets/webhook-url
        send_resolved: true
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: prometheus-data
  annotations: {{argocd.argoproj.io/sync-wave: "-20"}}
spec:
  accessModes: [ReadWriteOnce]
  resources:
    requests: {{storage: 10Gi}}
---
apiVersion: v1
kind: Service
metadata:
  name: prometheus
  annotations: {{argocd.argoproj.io/sync-wave: "5"}}
spec:
  selector: {{app.kubernetes.io/name: prometheus}}
  ports: [{{name: http, port: 9090, targetPort: http}}]
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prometheus
  annotations: {{argocd.argoproj.io/sync-wave: "5"}}
spec:
  replicas: 1
  selector: {{matchLabels: {{app.kubernetes.io/name: prometheus}}}}
  template:
    metadata:
      labels: {{app.kubernetes.io/name: prometheus, app.kubernetes.io/part-of: vnshop}}
    spec:
      automountServiceAccountToken: false
      securityContext: {{runAsNonRoot: true, runAsUser: 65534, runAsGroup: 65534, fsGroup: 65534, seccompProfile: {{type: RuntimeDefault}}}}
      containers:
      - name: prometheus
        image: prom/prometheus@sha256:075b1ba2c4ebb04bc3a6ab86c06ec8d8099f8fda1c96ef6d104d9bb1def1d8bc
        args: [--config.file=/etc/prometheus/prometheus.yml, --storage.tsdb.path=/prometheus, --storage.tsdb.retention.time=35d]
        ports: [{{name: http, containerPort: 9090}}]
        readinessProbe: {{httpGet: {{path: /-/ready, port: http}}}}
        resources:
          requests: {{cpu: 100m, memory: 256Mi}}
          limits: {{cpu: "1", memory: 1Gi}}
        securityContext: {{allowPrivilegeEscalation: false, readOnlyRootFilesystem: true, capabilities: {{drop: [ALL]}}}}
        volumeMounts:
        - {{name: config, mountPath: /etc/prometheus/prometheus.yml, subPath: prometheus.yml, readOnly: true}}
        - {{name: config, mountPath: /etc/prometheus/rules/alerts.yml, subPath: alerts.yml, readOnly: true}}
        - {{name: data, mountPath: /prometheus}}
      volumes:
      - {{name: config, configMap: {{name: vnshop-monitoring-config}}}}
      - {{name: data, persistentVolumeClaim: {{claimName: prometheus-data}}}}
---
apiVersion: v1
kind: Service
metadata:
  name: blackbox-exporter
  annotations: {{argocd.argoproj.io/sync-wave: "5"}}
spec:
  selector: {{app.kubernetes.io/name: blackbox-exporter}}
  ports: [{{name: http, port: 9115, targetPort: http}}]
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: blackbox-exporter
  annotations: {{argocd.argoproj.io/sync-wave: "5"}}
spec:
  replicas: 1
  selector: {{matchLabels: {{app.kubernetes.io/name: blackbox-exporter}}}}
  template:
    metadata:
      labels: {{app.kubernetes.io/name: blackbox-exporter, app.kubernetes.io/part-of: vnshop}}
    spec:
      automountServiceAccountToken: false
      securityContext: {{runAsNonRoot: true, runAsUser: 65534, runAsGroup: 65534, seccompProfile: {{type: RuntimeDefault}}}}
      containers:
      - name: blackbox-exporter
        image: prom/blackbox-exporter@sha256:b04a9fef4fa086a02fc7fcd8dcdbc4b7b35cc30cdee860fdc6a19dd8b208d63e
        args: [--config.file=/etc/blackbox/blackbox.yml]
        ports: [{{name: http, containerPort: 9115}}]
        readinessProbe: {{httpGet: {{path: /-/healthy, port: http}}}}
        resources: {{requests: {{cpu: 25m, memory: 32Mi}}, limits: {{cpu: 250m, memory: 128Mi}}}}
        securityContext: {{allowPrivilegeEscalation: false, readOnlyRootFilesystem: true, capabilities: {{drop: [ALL]}}}}
        volumeMounts: [{{name: config, mountPath: /etc/blackbox/blackbox.yml, subPath: blackbox.yml, readOnly: true}}]
      volumes: [{{name: config, configMap: {{name: vnshop-monitoring-config}}}}]
---
apiVersion: v1
kind: Service
metadata:
  name: prometheus-pushgateway
  annotations: {{argocd.argoproj.io/sync-wave: "5"}}
spec:
  selector: {{app.kubernetes.io/name: prometheus-pushgateway}}
  ports: [{{name: http, port: 9091, targetPort: http}}]
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prometheus-pushgateway
  annotations: {{argocd.argoproj.io/sync-wave: "5"}}
spec:
  replicas: 1
  selector: {{matchLabels: {{app.kubernetes.io/name: prometheus-pushgateway}}}}
  template:
    metadata:
      labels: {{app.kubernetes.io/name: prometheus-pushgateway, app.kubernetes.io/part-of: vnshop}}
    spec:
      automountServiceAccountToken: false
      securityContext: {{runAsNonRoot: true, runAsUser: 65534, runAsGroup: 65534, seccompProfile: {{type: RuntimeDefault}}}}
      containers:
      - name: pushgateway
        image: prom/pushgateway@sha256:98a458415f8f5afcfd45622d289a0aa67063563bec0f90d598ebc76783571936
        ports: [{{name: http, containerPort: 9091}}]
        readinessProbe: {{httpGet: {{path: /-/ready, port: http}}}}
        resources: {{requests: {{cpu: 25m, memory: 32Mi}}, limits: {{cpu: 250m, memory: 128Mi}}}}
        securityContext: {{allowPrivilegeEscalation: false, readOnlyRootFilesystem: true, capabilities: {{drop: [ALL]}}}}
---
apiVersion: v1
kind: Service
metadata:
  name: alertmanager
  annotations: {{argocd.argoproj.io/sync-wave: "5"}}
spec:
  selector: {{app.kubernetes.io/name: alertmanager}}
  ports: [{{name: http, port: 9093, targetPort: http}}]
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: alertmanager
  annotations: {{argocd.argoproj.io/sync-wave: "5"}}
spec:
  replicas: 1
  selector: {{matchLabels: {{app.kubernetes.io/name: alertmanager}}}}
  template:
    metadata:
      labels: {{app.kubernetes.io/name: alertmanager, app.kubernetes.io/part-of: vnshop}}
    spec:
      automountServiceAccountToken: false
      securityContext: {{runAsNonRoot: true, runAsUser: 65534, runAsGroup: 65534, seccompProfile: {{type: RuntimeDefault}}}}
      containers:
      - name: alertmanager
        image: prom/alertmanager@sha256:e13b6ed5cb929eeaee733479dce55e10eb3bc2e9c4586c705a4e8da41e5eacf5
        args: [--config.file=/etc/alertmanager/alertmanager.yml, --storage.path=/alertmanager]
        ports: [{{name: http, containerPort: 9093}}]
        readinessProbe: {{httpGet: {{path: /-/ready, port: http}}}}
        resources: {{requests: {{cpu: 25m, memory: 64Mi}}, limits: {{cpu: 250m, memory: 256Mi}}}}
        securityContext: {{allowPrivilegeEscalation: false, readOnlyRootFilesystem: true, capabilities: {{drop: [ALL]}}}}
        volumeMounts:
        - {{name: config, mountPath: /etc/alertmanager/alertmanager.yml, subPath: alertmanager.yml, readOnly: true}}
        - {{name: webhook, mountPath: /etc/alertmanager/secrets, readOnly: true}}
        - {{name: data, mountPath: /alertmanager}}
      volumes:
      - {{name: config, configMap: {{name: vnshop-monitoring-config}}}}
      - {{name: webhook, secret: {{secretName: vnshop-runtime-secrets, items: [{{key: alert-webhook-url, path: webhook-url}}]}}}}
      - {{name: data, emptyDir: {{sizeLimit: 1Gi}}}}
'''


def kafka_bootstrap_job() -> str:
    script = (REPO / "infra/scripts/init-kafka-topics.sh").read_text(encoding="utf-8")
    inventory = (REPO / "infra/kafka/topic-inventory.yaml").read_text(encoding="utf-8")
    return f'''apiVersion: v1
kind: ServiceAccount
metadata:
  name: vnshop-kafka-bootstrap
  annotations: {{argocd.argoproj.io/sync-wave: "-20"}}
automountServiceAccountToken: false
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: vnshop-kafka-bootstrap
  annotations: {{argocd.argoproj.io/sync-wave: "-10"}}
data:
  init-kafka-topics.sh: |
{indent(script, 4)}
  topic-inventory.yaml: |
{indent(inventory, 4)}
---
apiVersion: batch/v1
kind: Job
metadata:
  name: vnshop-kafka-bootstrap
  annotations:
    argocd.argoproj.io/hook: Sync
    argocd.argoproj.io/sync-wave: "-10"
    argocd.argoproj.io/hook-delete-policy: BeforeHookCreation,HookSucceeded
spec:
  backoffLimit: 6
  activeDeadlineSeconds: 900
  template:
    metadata:
      labels: {{app.kubernetes.io/name: vnshop-kafka-bootstrap, app.kubernetes.io/part-of: vnshop}}
    spec:
      restartPolicy: OnFailure
      serviceAccountName: vnshop-kafka-bootstrap
      automountServiceAccountToken: false
      securityContext: {{runAsNonRoot: true, runAsUser: 1000, runAsGroup: 1000, fsGroup: 1000, seccompProfile: {{type: RuntimeDefault}}}}
      containers:
      - name: bootstrap
        image: confluentinc/cp-kafka@sha256:acbbf674f2ed40e5d0a8ca51beb0f00692c866fc22b5ce06f8cadbdc54cd4436
        command: [bash, /opt/vnshop/init-kafka-topics.sh]
        workingDir: /opt/vnshop
        env:
        - name: KAFKA_ADMIN_PASSWORD
          valueFrom:
            secretKeyRef: {{name: vnshop-runtime-secrets, key: platform-kafka-admin-password}}
        - name: KAFKA_SSL_TRUSTSTORE_LOCATION
          value: /etc/kafka/tls/ca.truststore.jks
        - name: KAFKA_SSL_KEYSTORE_LOCATION
          value: /etc/kafka/tls/admin.keystore.jks
        - name: KAFKA_SSL_TRUSTSTORE_PASSWORD
          valueFrom:
            secretKeyRef: {{name: vnshop-runtime-secrets, key: platform-kafka-truststore-password}}
        - name: KAFKA_SSL_KEYSTORE_PASSWORD
          valueFrom:
            secretKeyRef: {{name: vnshop-runtime-secrets, key: platform-kafka-admin-keystore-password}}
        resources:
          requests: {{cpu: 25m, memory: 128Mi}}
          limits: {{cpu: 500m, memory: 512Mi}}
        securityContext: {{allowPrivilegeEscalation: false, readOnlyRootFilesystem: true, capabilities: {{drop: [ALL]}}}}
        volumeMounts:
        - {{name: script, mountPath: /opt/vnshop/init-kafka-topics.sh, subPath: init-kafka-topics.sh, readOnly: true}}
        - {{name: inventory, mountPath: /opt/vnshop/infra/kafka/topic-inventory.yaml, subPath: topic-inventory.yaml, readOnly: true}}
        - {{name: tmp, mountPath: /tmp}}
        - {{name: kafka-tls, mountPath: /etc/kafka/tls, readOnly: true}}
      volumes:
      - {{name: script, configMap: {{name: vnshop-kafka-bootstrap, defaultMode: 0555, items: [{{key: init-kafka-topics.sh, path: init-kafka-topics.sh}}]}}}}
      - {{name: inventory, configMap: {{name: vnshop-kafka-bootstrap, items: [{{key: topic-inventory.yaml, path: topic-inventory.yaml}}]}}}}
      - {{name: tmp, emptyDir: {{}}}}
      - name: kafka-tls
        secret:
          secretName: vnshop-runtime-secrets
          items:
          - {{key: platform-kafka-admin-keystore, path: admin.keystore.jks}}
          - {{key: platform-kafka-truststore, path: ca.truststore.jks}}
'''


def write_generated_files() -> None:
    deployables = CATALOG["deployables"]
    if len(deployables) != CATALOG["expectedCount"]:
        raise SystemExit("deployable catalog count does not match expectedCount")
    missing_ports = sorted({item["id"] for item in deployables} - set(PORTS))
    if missing_ports:
        raise SystemExit(f"missing ports for: {', '.join(missing_ports)}")

    (ROOT / "base/workloads.yaml").write_text(
        "\n".join(workload_documents(item) for item in deployables), encoding="utf-8"
    )
    (ROOT / "base/migration-job.yaml").write_text(migration_job(), encoding="utf-8")
    (ROOT / "base/monitoring.yaml").write_text(monitoring_manifest(), encoding="utf-8")
    (ROOT / "base/kafka-bootstrap-job.yaml").write_text(kafka_bootstrap_job(), encoding="utf-8")
    for env, name, replicas, max_replicas in (
        ("dev", "vnshop-dev", 1, 3),
        ("staging", "vnshop-staging", 2, 6),
        ("prod", "vnshop-prod", 3, 10),
    ):
        directory = ROOT / "overlays" / env
        directory.mkdir(parents=True, exist_ok=True)
        (directory / "namespace.yaml").write_text(namespace(env, name), encoding="utf-8")
        (directory / "kustomization.yaml").write_text(
            overlay(env, name, replicas, max_replicas), encoding="utf-8"
        )
        if env in {"staging", "prod"}:
            (directory / "ingress.yaml").write_text(ingress(env), encoding="utf-8")
        if env in {"staging", "prod"}:
            realm_source = (REPO / "infra/keycloak/vnshop-realm-prod.json").read_text(encoding="utf-8")
            realm_source = realm_source.replace("vnshop.example", "vnshop.invalid") if env == "staging" else realm_source
            realm_filename = "vnshop-realm-prod.json" if env == "prod" else "vnshop-realm.json"
            (directory / realm_filename).write_text(
                realm_source,
                encoding="utf-8",
            )
            (directory / "keycloak-import-patch.yaml").write_text(
                keycloak_import_patch(), encoding="utf-8"
            )
            (directory / "keycloak-reconcile-job.yaml").write_text(
                keycloak_reconcile_job(), encoding="utf-8"
            )

    print(f"generated Kubernetes manifests for {len(deployables)} deployables")


if __name__ == "__main__":
    write_generated_files()
