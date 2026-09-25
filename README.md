# Discord Community Platform

منصة عربية حديثة لمجتمع Discord: حسابات، ألعاب وجلسات، قروبات، سينما، تقييمات، إحصائيات ولوقات.

## التشغيل محلياً

```bash
npm install
npm start
```
ثم افتح `http://localhost:3000`.

في أول تشغيل يتم إنشاء حساب المشرف من متغيرات البيئة:

```bash
ADMIN_USERNAME=admin ADMIN_PASSWORD=غيّرني JWT_SECRET=secret npm start
```

## النشر على Railway

1. ارفع المستودع إلى Railway كـ **GitHub Repo**.
2. Railway سيشغل `npm install` ثم `npm start` تلقائياً.
3. أضف Variables: `JWT_SECRET` و`ADMIN_USERNAME` و`ADMIN_PASSWORD`.
4. أضف Volume إلى `/app/data` حتى لا تضيع بيانات JSON عند إعادة النشر.
5. اربط دومينك من Settings > Networking.

## Discord

النسخة الأساسية تعمل بدون بوتات وتجهز API واضحاً للتكامل. لإضافة البوتات لاحقاً، أنشئ خدمات مستقلة تستخدم `INTERNAL_API_URL` و`BOT_SHARED_SECRET`. لا تضع أي Bot Token داخل المستودع.

## ملاحظات مهمة

- التخزين الافتراضي في `data/store.json` مناسب للبداية. للإنتاج الكبير استبدله بـ PostgreSQL/Redis.
- السينما تستخدم روابط فيديو مصرحاً لك بعرضها ولا تتجاوز حماية أو حقوق المنصات.
- أدوات التحميل يجب أن تلتزم بشروط كل منصة وحقوق أصحاب المحتوى.
