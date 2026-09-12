FROM ghcr.io/cirruslabs/android-sdk:35

USER root
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends nodejs npm ca-certificates && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://services.gradle.org/distributions/gradle-8.9-bin.zip -o /tmp/gradle.zip \
 && unzip -q /tmp/gradle.zip -d /opt/gradle \
 && rm /tmp/gradle.zip
ENV PATH="/opt/gradle/gradle-8.9/bin:${PATH}"

WORKDIR /app
COPY factory-apk-builder/package.json ./package.json
COPY factory-apk-builder/server.mjs ./server.mjs
COPY apps/budget-dapp-android ./template
RUN printf '%s\n' \
 'org.gradle.jvmargs=-Xmx256m -XX:MaxMetaspaceSize=256m -XX:ReservedCodeCacheSize=64m -Xss512k -Dfile.encoding=UTF-8 -Dorg.gradle.vfs.watch=false' \
 'org.gradle.daemon=false' \
 'org.gradle.parallel=false' \
 'org.gradle.workers.max=1' \
 'org.gradle.caching=false' \
 'android.useAndroidX=true' \
 'android.enableJetifier=false' \
 'android.nonTransitiveRClass=true' \
 > /app/template/gradle.properties
RUN mkdir -p /data/jobs && chmod 700 /data/jobs

ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.mjs"]
