globalThis.HEX_CONFIG = {
  "version": "rules-2.0",
  "message_rules": [
    [
      "MSG-01",
      "pressure",
      "Urgency or service disruption",
      13,
      "within\\s+\\d+\\s*(?:min(?:utes?)?|hours?|hrs?)|immediately|today only|last warning|(?:account|power|electricity|connection).{0,26}(?:blocked|suspended|disconnected|blocking)|final notice"
    ],
    [
      "MSG-02",
      "credential",
      "Sensitive information request",
      26,
      "(?:enter|share|verify|submit|confirm|upload|provide).{0,40}(?:otp|pin\\b|password|aadhaar|pan\\b|bank details|card details)|(?:otp|pin|password)\\s+(?:required|verification)"
    ],
    [
      "MSG-03",
      "payment",
      "Payment or upfront fee",
      19,
      "upi\\s*(?:id|payment)?\\s*[:\\-]|(?:processing|delivery|release|registration|activation|advance)\\s+fee|(?:pay|transfer|deposit).{0,18}(?:₹|inr|rs\\.?\\s|\\d)"
    ],
    [
      "MSG-04",
      "lure",
      "Service or identity pretext",
      11,
      "\\b(?:kyc|parcel|delivery attempt|electricity bill|e-challan|job offer|recruitment|account verification)\\b"
    ],
    [
      "MSG-05",
      "returns",
      "Unusual loan or return promise",
      18,
      "guaranteed\\s+(?:daily|returns?|profit)|(?:double|triple)\\s+your\\s+money|instant\\s+(?:loan|approval)|no credit check"
    ],
    [
      "MSG-06",
      "referral",
      "Referral or betting promotion",
      11,
      "referral\\s+(?:bonus|commission|income)|downline|multi.level marketing|(?:betting|wagering)\\s+(?:bonus|platform|deposit)"
    ],
    [
      "MSG-07",
      "brand",
      "Unverified official authority claim",
      9,
      "\\b(?:official|government|police|rbi).{0,20}(?:portal|notice|approved|team|desk)|\\b(?:rajgrid|quickparcel|suraksha bank)\\b"
    ],
    ["MSG-08","pressure","Hindi urgency or service interruption",13,"तुरंत|अंतिम चेतावनी|(?:बिजली|खाता).{0,24}(?:बंद|काट)|(?:abhi|turant).{0,20}(?:karo|karein)"],
    ["MSG-09","credential","Hindi request for a verification code or password",26,"(?:ओटीपी|पासवर्ड|पिन|OTP).{0,24}(?:बताएं|भेजें|साझा|डालें|bhej|bata)"],
    ["MSG-10","payment","Hindi payment or fee request",19,"भुगतान.{0,18}(?:करें|करो|करना)|(?:प्रोसेसिंग|डिलीवरी) शुल्क|paise.{0,16}(?:bhej|jama)"]
  ],
  "weights": {
    "MSG-01": 13,
    "MSG-02": 26,
    "MSG-03": 19,
    "MSG-04": 11,
    "MSG-05": 18,
    "MSG-06": 11,
    "MSG-07": 9,
    "URL-01": 24,
    "URL-02": 16,
    "URL-03": 12,
    "URL-04": 12,
    "URL-05": 12,
    "URL-06": 8,
    "EML-REPLY-TO": 15,
    "EML-RETURN-PATH": 15,
    "EML-AUTH": 12,
    "APK-01": 18,
    "APK-02": 30,
    "DOM-01": 10,
    "WEB-01": 16,
    "WEB-02": 14
  },
  "bands": [
    [
      "Critical",
      75
    ],
    [
      "High",
      50
    ],
    [
      "Moderate",
      25
    ],
    [
      "Low",
      0
    ]
  ]
};
