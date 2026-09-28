# 🚀 SRCC Timetable Web App: Hosting, Domain & Automation Guide

> **दिनांक:** 26 सितम्बर 2026  
> **प्रोजेक्ट:** SRCC Timetable & Faculty Locator (`web_app`)

---

## 📌 1. समस्या का मुख्य कारण (Root Cause: Netlify Credits Exhausted)

### वेबसाइट क्यों बंद हुई?
Netlify के Free Plan में हर महीने **300 Build Minutes** मिलते हैं।
आपके प्रोजेक्ट में GitHub Actions में दो ऑटो-सिंक वर्कफ़्लो सेट थे:
1. `auto_sync_leaves.yml`: कॉलेज के समय हर **30 मिनट** में चलता है।
2. `auto_sync_timetable.yml`: हर **4 घंटे** में चलता है।

जब भी डेटा अपडेट होता था, तो यह Netlify के **Build Hook** को ट्रिगर करता था या कमिट पुश होने पर Netlify क्लाउड पर साइट रीबिल्ड करता था। हर बिल्ड में कम से कम 1 मिनट लगता है:
$$\text{हर 30 मिनट में बिल्ड} \implies 48 \text{ बिल्ड / दिन} \implies 4 \text{ दिनों में 300 फ्री मिनट्स खत्म!}$$
इसी वजह से Netlify ने साइट को "Credits Exhausted" के कारण सस्पेंड / रोक दिया।

---

## 🌐 2. डोमेन (Domain) संबंधी नियम

### क्या पुराने डोमेन पर ही नए Netlify या GitHub से चला सकते हैं?

| डोमेन का प्रकार | उदाहरण | क्या नया होस्ट पर वही सेम डोमेन चलेगा? | कैसे करें? |
| :--- | :--- | :---: | :--- |
| **Custom Domain** | `srccrooms.in`, `srcc.com` | **हाँ (100%)** | अपने डोमेन रजिस्ट्रार (GoDaddy / Cloudflare / Namecheap) में जाकर DNS (CNAME / A record) नए होस्ट पर पॉइंट कर दें। |
| **Netlify Subdomain** | `srcc-free-classrooms.netlify.app` | **हाँ (शर्त के साथ)** | यह डोमेन केवल Netlify पर ही चल सकता है (GitHub Pages पर `.netlify.app` नहीं चल सकता)।<br>लेकिन **नए Netlify अकाउंट में वही नाम पाने के लिए:**<br>1. पुराने Netlify में Site Details $\rightarrow$ **Change site name** करके कोई रैंडम नाम कर दें (या साइट Delete कर दें)।<br>2. नए Netlify अकाउंट में जाकर वही मूल नाम रख लें। नाम तुरंत रिलीज होकर नए खाते में मिल जाएगा। |

---

## 📦 3. मैनुअल डिप्लॉय (Netlify Drop)

वेबसाइट का 100% फ्रंटएंड कोड और डेटा सिर्फ **`web_app/`** फोल्डर में है। Python और एक्सेल फाइल्स बैकएंड स्क्रेपिंग के लिए हैं।

### डिप्लॉय करने के स्टेप्स:
1. टर्मिनल में पैकेजिंग कमांड चलाएं:
   ```powershell
   node package_netlify.js
   ```
2. यह फाइल तैयार करेगा:
   📁 `C:\Users\anand_fua08yg\Downloads\srcc_web_app_for_netlify.zip`
3. ब्राउज़र में जाएं: **[https://app.netlify.com/drop](https://app.netlify.com/drop)**
4. उस ज़िप फाइल को खींच कर छोड़ (Drag & Drop) दें।
5. साइट 5 सेकंड में लाइव हो जाएगी।
6. **Site Configuration** $\rightarrow$ **Change site name** में जाकर अपना मनपसंद नाम सेट करें।

---

## ⚙️ 4. क्या अब बैकएंड और ऑटोमेशन काम करेगा?

**वर्तमान स्थिति:**
* **वेबसाइट (Live Site):** आज के डेटा के साथ पूरी तरह काम करेगी।
* **ऑटोमेशन (Auto-Sync):** **अभी काम नहीं करेगा**, क्योंकि GitHub Actions को आपके नए Netlify साइट का पता नहीं है। जब तक नया लिंक नहीं जोड़ा जाएगा, कॉलेज के नए टाइमटेबल और लीव अपने-आप वेबसाइट पर लाइव नहीं होंगे।

---

## 🛠️ 5. ऑटोमेशन चालू करने के 2 विकल्प

### 🌟 विकल्प A: Direct Deploy via GitHub Actions (बेस्ट - 0 क्रेडिट्स खर्च होंगे!)
> **फायदा:** इसमें Netlify का **0 Build Minute** खर्च होता है! चाहे दिन में 100 बार सिंक हो, Netlify के क्रेडिट्स **कभी खत्म नहीं होंगे**।

#### स्टेप्स:
1. **Netlify Personal Access Token प्राप्त करें:**
   * Netlify में ऊपर दाएँ कोने में अपनी प्रोफाइल $\rightarrow$ **User settings** $\rightarrow$ **Applications** पर क्लिक करें।
   * **Personal access tokens** $\rightarrow$ **New access token** पर क्लिक करें।
   * नाम दें: `github-actions-sync` और Generate करें। टोकन कॉपी कर लें।
2. **Netlify Site ID प्राप्त करें:**
   * अपने नए साइट डैशबोर्ड पर जाएं $\rightarrow$ **Site configuration** $\rightarrow$ **General**.
   * वहाँ **Site ID** कॉपी करें (जैसे: `a1b2c3d4-...`).
3. **GitHub Secrets में सेव करें:**
   * अपनी GitHub Repository में जाएं $\rightarrow$ **Settings** $\rightarrow$ **Secrets and variables** $\rightarrow$ **Actions**.
   * दो नए Secret बनाएं:
     * `NETLIFY_AUTH_TOKEN` = (आपका Access Token)
     * `NETLIFY_SITE_ID` = (आपकी Site ID)
4. GitHub Actions वर्कफ़्लो में Curl Build Hook की जगह `netlify deploy --dir=web_app --prod` लगा दिया जाता है।

---

### ⚡ विकल्प B: Build Hook जोड़ना (आसान लेकिन मिनट्स खर्च होंगे)
> **चेतावनी:** इसमें हर सिंक पर 1 मिनट खर्च होता है, इसलिए 300 मिनट लिमिट का ध्यान रखना होगा।

#### स्टेप्स:
1. **नए Netlify पर जाएं:**
   * Site Dashboard $\rightarrow$ **Site configuration** $\rightarrow$ **Build & deploy** $\rightarrow$ **Continuous deployment**.
   * नीचे स्क्रॉल करके **Build hooks** $\rightarrow$ **Add build hook** पर क्लिक करें।
   * नाम: `github-sync`, Branch: `main` चुनकर **Save** करें।
   * जो URL मिले (`https://api.netlify.com/build_hooks/...`), उसे कॉपी कर लें।
2. **GitHub Secrets में अपडेट करें:**
   * GitHub Repository $\rightarrow$ **Settings** $\rightarrow$ **Secrets and variables** $\rightarrow$ **Actions**.
   * `NETLIFY_BUILD_HOOK` को एडिट करके नया URL पेस्ट कर दें।

---

## 🎯 6. वैकल्पिक समाधान: GitHub Pages (100% Free Forever)
अगर आप Netlify के किसी भी झंझट से हमेशा के लिए मुक्त होना चाहते हैं:
1. GitHub Repo $\rightarrow$ **Settings** $\rightarrow$ **Pages** पर जाएं।
2. Source में **GitHub Actions** या **Deploy from branch** चुनें।
3. GitHub Pages पर कोई मासिक क्रेडिट लिमिट नहीं होती। टाइमटेबल और लीव हमेशा फ्री में सिंक होते रहेंगे।

---

*दस्तावेज़ तैयार: 26/09/2026*
