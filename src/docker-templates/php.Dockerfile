FROM php:{{version}}-fpm-alpine

RUN apk add --no-cache \
    git curl zip unzip libpq-dev icu-dev \
    && docker-php-ext-install pdo pdo_pgsql pdo_mysql intl opcache

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /app

COPY . .

RUN composer install --no-interaction --prefer-dist

EXPOSE {{port}}

CMD ["php-fpm"]
