---
name: Amplopay Payment Gateway Integration
description: Amplopay API details for plan subscriptions - PIX, card, boleto
type: feature
---
- Base URL: https://app.amplopay.com/api/v1
- Auth: x-public-key + x-secret-key headers
- PIX subscription: POST /gateway/pix/subscription
- Webhook events: TRANSACTION_CREATED, TRANSACTION_PAID, TRANSACTION_CANCELED, TRANSACTION_REFUNDED
- Transaction statuses: COMPLETED, FAILED, PENDING, REFUNDED, CHARGED_BACK
- Webhook payload includes: event, token, client, transaction, subscription, orderItems
- Edge functions: amplopay-subscribe (creates payment), amplopay-webhook (processes callbacks)
- Keys stored in platform_settings: amplopay_public_key, amplopay_secret_key
