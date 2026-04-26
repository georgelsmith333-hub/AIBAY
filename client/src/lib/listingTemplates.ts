export interface ListingTemplate {
  id: string;
  name: string;
  emoji: string;
  category: string;
  description: string;
  htmlTemplate: string;
  exampleTitle: string;
  keyFields: string[];
}

function build(content: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:20px;color:#222;">
${content}
</div>`;
}

export const LISTING_TEMPLATES: ListingTemplate[] = [
  {
    id: "electronics",
    name: "Electronics / Tech",
    emoji: "📱",
    category: "Electronics",
    description: "Perfect for phones, tablets, laptops, cameras, smart devices",
    exampleTitle: "Apple iPhone 15 Pro 256GB Space Black Unlocked - Pristine Condition",
    keyFields: ["Brand", "Model", "Storage", "Colour", "Condition", "Network", "Accessories Included"],
    htmlTemplate: build(`
<h2 style="color:#0064d2;border-bottom:3px solid #0064d2;padding-bottom:10px;">📱 {{PRODUCT_NAME}}</h2>

<table style="width:100%;border-collapse:collapse;margin:20px 0;">
  <tr style="background:#f5f5f5;"><td style="padding:10px;font-weight:bold;width:40%;">Brand</td><td style="padding:10px;">{{BRAND}}</td></tr>
  <tr><td style="padding:10px;font-weight:bold;background:#fff;">Model</td><td style="padding:10px;">{{MODEL}}</td></tr>
  <tr style="background:#f5f5f5;"><td style="padding:10px;font-weight:bold;">Storage</td><td style="padding:10px;">{{STORAGE}}</td></tr>
  <tr><td style="padding:10px;font-weight:bold;background:#fff;">Colour</td><td style="padding:10px;">{{COLOUR}}</td></tr>
  <tr style="background:#f5f5f5;"><td style="padding:10px;font-weight:bold;">Condition</td><td style="padding:10px;">{{CONDITION}}</td></tr>
  <tr><td style="padding:10px;font-weight:bold;background:#fff;">Network Lock</td><td style="padding:10px;">{{NETWORK}}</td></tr>
</table>

<h3 style="color:#333;">✅ What's Included</h3>
<ul style="line-height:1.8;">
  <li>{{PRODUCT_NAME}}</li>
  <li>{{ACCESSORIES}}</li>
</ul>

<h3 style="color:#333;">⭐ Key Features</h3>
<ul style="line-height:1.8;">
  <li>{{FEATURE_1}}</li>
  <li>{{FEATURE_2}}</li>
  <li>{{FEATURE_3}}</li>
</ul>

<div style="background:#e8f4ff;border-left:4px solid #0064d2;padding:15px;margin:20px 0;border-radius:4px;">
  <strong>🔒 Condition Notes:</strong> {{CONDITION_DETAILS}}
</div>

<h3 style="color:#333;">🚚 Shipping & Returns</h3>
<p>Fast dispatch — shipped within 1 business day. Tracked delivery included. 30-day returns accepted.</p>

<p style="color:#777;font-size:12px;margin-top:30px;border-top:1px solid #eee;padding-top:15px;">
  All items are tested and verified before dispatch. Questions? Message us anytime.
</p>`),
  },
  {
    id: "clothing",
    name: "Clothing & Accessories",
    emoji: "👗",
    category: "Fashion",
    description: "Apparel, shoes, bags, jewellery and fashion accessories",
    exampleTitle: "Nike Air Max 270 React Mens Trainers Size 10 White Black Brand New",
    keyFields: ["Brand", "Size", "Colour", "Material", "Condition", "Style", "Gender"],
    htmlTemplate: build(`
<h2 style="color:#c0392b;border-bottom:3px solid #c0392b;padding-bottom:10px;">👗 {{PRODUCT_NAME}}</h2>

<table style="width:100%;border-collapse:collapse;margin:20px 0;">
  <tr style="background:#fdf5f5;"><td style="padding:10px;font-weight:bold;width:40%;">Brand</td><td style="padding:10px;">{{BRAND}}</td></tr>
  <tr><td style="padding:10px;font-weight:bold;">Size</td><td style="padding:10px;">{{SIZE}} — see size guide below</td></tr>
  <tr style="background:#fdf5f5;"><td style="padding:10px;font-weight:bold;">Colour</td><td style="padding:10px;">{{COLOUR}}</td></tr>
  <tr><td style="padding:10px;font-weight:bold;">Material</td><td style="padding:10px;">{{MATERIAL}}</td></tr>
  <tr style="background:#fdf5f5;"><td style="padding:10px;font-weight:bold;">Condition</td><td style="padding:10px;">{{CONDITION}}</td></tr>
  <tr><td style="padding:10px;font-weight:bold;">Style</td><td style="padding:10px;">{{STYLE}}</td></tr>
</table>

<h3 style="color:#333;">📐 Size Guide</h3>
<p>{{SIZE_GUIDE}}</p>

<h3 style="color:#333;">✨ Product Details</h3>
<ul style="line-height:1.8;">
  <li>{{FEATURE_1}}</li>
  <li>{{FEATURE_2}}</li>
  <li>{{FEATURE_3}}</li>
</ul>

<div style="background:#fdf5e4;border-left:4px solid #e67e22;padding:15px;margin:20px 0;border-radius:4px;">
  <strong>📦 Condition Note:</strong> {{CONDITION_DETAILS}}
</div>

<h3 style="color:#333;">🚚 Shipping & Returns</h3>
<p>Dispatched same or next business day. Carefully packaged. Returns accepted within 30 days — buyer pays return shipping on change-of-mind returns.</p>`),
  },
  {
    id: "home-garden",
    name: "Home & Garden",
    emoji: "🏡",
    category: "Home",
    description: "Furniture, appliances, kitchenware, décor, tools, garden items",
    exampleTitle: "Dyson V11 Cordless Vacuum Cleaner Animal Extra - 2023 Model Excellent",
    keyFields: ["Brand", "Type", "Colour", "Dimensions", "Material", "Condition", "Power Source"],
    htmlTemplate: build(`
<h2 style="color:#27ae60;border-bottom:3px solid #27ae60;padding-bottom:10px;">🏡 {{PRODUCT_NAME}}</h2>

<table style="width:100%;border-collapse:collapse;margin:20px 0;">
  <tr style="background:#f0fff4;"><td style="padding:10px;font-weight:bold;width:40%;">Brand</td><td style="padding:10px;">{{BRAND}}</td></tr>
  <tr><td style="padding:10px;font-weight:bold;">Type</td><td style="padding:10px;">{{TYPE}}</td></tr>
  <tr style="background:#f0fff4;"><td style="padding:10px;font-weight:bold;">Colour</td><td style="padding:10px;">{{COLOUR}}</td></tr>
  <tr><td style="padding:10px;font-weight:bold;">Dimensions</td><td style="padding:10px;">{{DIMENSIONS}}</td></tr>
  <tr style="background:#f0fff4;"><td style="padding:10px;font-weight:bold;">Material</td><td style="padding:10px;">{{MATERIAL}}</td></tr>
  <tr><td style="padding:10px;font-weight:bold;">Condition</td><td style="padding:10px;">{{CONDITION}}</td></tr>
</table>

<h3 style="color:#333;">🔑 Key Features</h3>
<ul style="line-height:1.8;">
  <li>{{FEATURE_1}}</li>
  <li>{{FEATURE_2}}</li>
  <li>{{FEATURE_3}}</li>
  <li>{{FEATURE_4}}</li>
</ul>

<div style="background:#f0fff4;border-left:4px solid #27ae60;padding:15px;margin:20px 0;border-radius:4px;">
  <strong>📦 Condition Details:</strong> {{CONDITION_DETAILS}}
</div>

<h3 style="color:#333;">🚚 Delivery</h3>
<p>{{SHIPPING_INFO}} — carefully wrapped and protected for safe delivery. Contact us for combined postage on multiple purchases.</p>`),
  },
  {
    id: "collectibles",
    name: "Collectibles & Antiques",
    emoji: "🎭",
    category: "Collectibles",
    description: "Coins, stamps, vintage items, sports memorabilia, art, antiques",
    exampleTitle: "Rare 1966 World Cup England Commemorative Coin Set Original Case EF",
    keyFields: ["Era / Year", "Origin / Country", "Condition Grade", "Provenance", "Rarity", "Authenticity"],
    htmlTemplate: build(`
<h2 style="color:#8e44ad;border-bottom:3px solid #8e44ad;padding-bottom:10px;">🎭 {{PRODUCT_NAME}}</h2>

<div style="background:#f8f0ff;border:1px solid #d7bde2;padding:15px;border-radius:6px;margin:15px 0;">
  <strong>🔍 Quick Reference</strong>
  <table style="width:100%;margin-top:10px;border-collapse:collapse;">
    <tr><td style="padding:6px;font-weight:bold;width:40%;">Era / Year</td><td style="padding:6px;">{{ERA}}</td></tr>
    <tr style="background:#f0e8ff;"><td style="padding:6px;font-weight:bold;">Origin</td><td style="padding:6px;">{{ORIGIN}}</td></tr>
    <tr><td style="padding:6px;font-weight:bold;">Condition</td><td style="padding:6px;">{{CONDITION}}</td></tr>
    <tr style="background:#f0e8ff;"><td style="padding:6px;font-weight:bold;">Rarity</td><td style="padding:6px;">{{RARITY}}</td></tr>
  </table>
</div>

<h3 style="color:#333;">📖 Description</h3>
<p style="line-height:1.7;">{{FULL_DESCRIPTION}}</p>

<h3 style="color:#333;">🔎 Detailed Condition Report</h3>
<p style="line-height:1.7;">{{CONDITION_DETAILS}}</p>

<h3 style="color:#333;">📜 Provenance & Authenticity</h3>
<p>{{PROVENANCE}}</p>

<div style="background:#fff9e6;border-left:4px solid #f1c40f;padding:15px;margin:20px 0;border-radius:4px;">
  <strong>⚠️ Please Note:</strong> All items are sold as seen. Please study photos carefully and ask any questions before bidding. No returns on vintage/antique items unless significantly not as described.
</div>

<h3 style="color:#333;">📦 Packaging & Shipping</h3>
<p>Packed with care using protective materials. Tracked and insured postage. Combined shipping available.</p>`),
  },
  {
    id: "sports",
    name: "Sports & Outdoors",
    emoji: "⚽",
    category: "Sports",
    description: "Fitness equipment, outdoor gear, bikes, sports clothing, team kit",
    exampleTitle: "Wahoo Kickr Snap Smart Turbo Trainer Excellent Condition + Accessories",
    keyFields: ["Brand", "Sport / Activity", "Size", "Colour", "Condition", "Weight", "Accessories"],
    htmlTemplate: build(`
<h2 style="color:#e74c3c;border-bottom:3px solid #e74c3c;padding-bottom:10px;">⚽ {{PRODUCT_NAME}}</h2>

<table style="width:100%;border-collapse:collapse;margin:20px 0;">
  <tr style="background:#fff5f5;"><td style="padding:10px;font-weight:bold;width:40%;">Brand</td><td style="padding:10px;">{{BRAND}}</td></tr>
  <tr><td style="padding:10px;font-weight:bold;">Sport / Activity</td><td style="padding:10px;">{{SPORT}}</td></tr>
  <tr style="background:#fff5f5;"><td style="padding:10px;font-weight:bold;">Size / Spec</td><td style="padding:10px;">{{SIZE}}</td></tr>
  <tr><td style="padding:10px;font-weight:bold;">Colour</td><td style="padding:10px;">{{COLOUR}}</td></tr>
  <tr style="background:#fff5f5;"><td style="padding:10px;font-weight:bold;">Condition</td><td style="padding:10px;">{{CONDITION}}</td></tr>
</table>

<h3 style="color:#333;">💪 Key Features</h3>
<ul style="line-height:1.8;">
  <li>{{FEATURE_1}}</li>
  <li>{{FEATURE_2}}</li>
  <li>{{FEATURE_3}}</li>
</ul>

<h3 style="color:#333;">📦 What's Included</h3>
<ul style="line-height:1.8;">
  <li>{{PRODUCT_NAME}}</li>
  <li>{{ACCESSORIES}}</li>
</ul>

<div style="background:#fff5f5;border-left:4px solid #e74c3c;padding:15px;margin:20px 0;border-radius:4px;">
  <strong>🔍 Condition Notes:</strong> {{CONDITION_DETAILS}}
</div>

<p>Fast tracked dispatch. Questions about compatibility or specifications? Message us — happy to help.</p>`),
  },
  {
    id: "toys-games",
    name: "Toys, Games & Hobbies",
    emoji: "🎮",
    category: "Toys",
    description: "Board games, video games, action figures, LEGO, RC, model kits",
    exampleTitle: "LEGO Technic 42099 4x4 X-treme Off-Roader Set Complete 100% Rare",
    keyFields: ["Brand", "Age Range", "Set / Model Number", "Condition", "Completeness", "Year"],
    htmlTemplate: build(`
<h2 style="color:#e67e22;border-bottom:3px solid #e67e22;padding-bottom:10px;">🎮 {{PRODUCT_NAME}}</h2>

<div style="background:#fff8f0;border:1px solid #fad5a5;padding:15px;border-radius:6px;margin:15px 0;">
  <table style="width:100%;border-collapse:collapse;">
    <tr><td style="padding:8px;font-weight:bold;width:40%;">Brand</td><td style="padding:8px;">{{BRAND}}</td></tr>
    <tr style="background:#fef9f0;"><td style="padding:8px;font-weight:bold;">Set / Model</td><td style="padding:8px;">{{SET_NUMBER}}</td></tr>
    <tr><td style="padding:8px;font-weight:bold;">Age Range</td><td style="padding:8px;">{{AGE_RANGE}}</td></tr>
    <tr style="background:#fef9f0;"><td style="padding:8px;font-weight:bold;">Year Released</td><td style="padding:8px;">{{YEAR}}</td></tr>
    <tr><td style="padding:8px;font-weight:bold;">Condition</td><td style="padding:8px;">{{CONDITION}}</td></tr>
    <tr style="background:#fef9f0;"><td style="padding:8px;font-weight:bold;">Completeness</td><td style="padding:8px;">{{COMPLETENESS}}</td></tr>
  </table>
</div>

<h3 style="color:#333;">⭐ Description</h3>
<p style="line-height:1.7;">{{FULL_DESCRIPTION}}</p>

<h3 style="color:#333;">📦 What's Included</h3>
<ul style="line-height:1.8;">
  <li>{{CONTENTS}}</li>
</ul>

<div style="background:#fff8f0;border-left:4px solid #e67e22;padding:15px;margin:20px 0;border-radius:4px;">
  <strong>🔍 Condition Notes:</strong> {{CONDITION_DETAILS}}
</div>

<p>Smoke-free, pet-free home. Carefully packed. Questions welcome — happy to provide more photos on request.</p>`),
  },
  {
    id: "health-beauty",
    name: "Health & Beauty",
    emoji: "💄",
    category: "Health",
    description: "Skincare, makeup, supplements, hair care, medical devices, fragrances",
    exampleTitle: "Dyson Airwrap Complete Styler Long Barrel - New Sealed UK Plug Rose",
    keyFields: ["Brand", "Product Type", "Size / Volume", "Expiry Date", "Skin Type", "Condition"],
    htmlTemplate: build(`
<h2 style="color:#e91e8c;border-bottom:3px solid #e91e8c;padding-bottom:10px;">💄 {{PRODUCT_NAME}}</h2>

<table style="width:100%;border-collapse:collapse;margin:20px 0;">
  <tr style="background:#fff0f8;"><td style="padding:10px;font-weight:bold;width:40%;">Brand</td><td style="padding:10px;">{{BRAND}}</td></tr>
  <tr><td style="padding:10px;font-weight:bold;">Product Type</td><td style="padding:10px;">{{TYPE}}</td></tr>
  <tr style="background:#fff0f8;"><td style="padding:10px;font-weight:bold;">Size / Volume</td><td style="padding:10px;">{{SIZE}}</td></tr>
  <tr><td style="padding:10px;font-weight:bold;">Shade / Scent</td><td style="padding:10px;">{{SHADE}}</td></tr>
  <tr style="background:#fff0f8;"><td style="padding:10px;font-weight:bold;">Condition</td><td style="padding:10px;">{{CONDITION}}</td></tr>
  <tr><td style="padding:10px;font-weight:bold;">Expiry / Best Before</td><td style="padding:10px;">{{EXPIRY}}</td></tr>
</table>

<h3 style="color:#333;">✨ Key Benefits</h3>
<ul style="line-height:1.8;">
  <li>{{BENEFIT_1}}</li>
  <li>{{BENEFIT_2}}</li>
  <li>{{BENEFIT_3}}</li>
</ul>

<div style="background:#fff0f8;border-left:4px solid #e91e8c;padding:15px;margin:20px 0;border-radius:4px;">
  <strong>📦 Condition:</strong> {{CONDITION_DETAILS}}
</div>

<p style="color:#777;font-size:12px;">For external use only unless otherwise stated. Please check ingredients if you have known allergies. We are not responsible for adverse reactions.</p>

<h3 style="color:#333;">🚚 Shipping</h3>
<p>Safely packaged to prevent damage in transit. Tracked delivery. Returns accepted within 14 days if sealed/unused.</p>`),
  },
  {
    id: "vehicle-parts",
    name: "Vehicle Parts & Accessories",
    emoji: "🔧",
    category: "Motors",
    description: "Car parts, motorcycle accessories, tools, tyres, audio, body kits",
    exampleTitle: "Bosch 0001108177 Starter Motor BMW 3 Series E46 2.0 318i 2001-2005",
    keyFields: ["Brand", "Part Number", "Compatible Vehicles", "Condition", "OEM / Aftermarket", "Warranty"],
    htmlTemplate: build(`
<h2 style="color:#2c3e50;border-bottom:3px solid #2c3e50;padding-bottom:10px;">🔧 {{PRODUCT_NAME}}</h2>

<div style="background:#eaf2ff;border:2px solid #2980b9;padding:15px;border-radius:6px;margin:15px 0;">
  <strong>⚠️ Vehicle Compatibility</strong>
  <p style="margin:8px 0;">{{COMPATIBLE_VEHICLES}}</p>
  <p style="font-size:12px;color:#555;">Always verify fitment using your vehicle's VIN or registration before purchasing.</p>
</div>

<table style="width:100%;border-collapse:collapse;margin:20px 0;">
  <tr style="background:#f0f4f8;"><td style="padding:10px;font-weight:bold;width:40%;">Brand</td><td style="padding:10px;">{{BRAND}}</td></tr>
  <tr><td style="padding:10px;font-weight:bold;">Part Number</td><td style="padding:10px;">{{PART_NUMBER}}</td></tr>
  <tr style="background:#f0f4f8;"><td style="padding:10px;font-weight:bold;">OEM / Aftermarket</td><td style="padding:10px;">{{OEM}}</td></tr>
  <tr><td style="padding:10px;font-weight:bold;">Condition</td><td style="padding:10px;">{{CONDITION}}</td></tr>
  <tr style="background:#f0f4f8;"><td style="padding:10px;font-weight:bold;">Warranty</td><td style="padding:10px;">{{WARRANTY}}</td></tr>
</table>

<h3 style="color:#333;">🔑 Features</h3>
<ul style="line-height:1.8;">
  <li>{{FEATURE_1}}</li>
  <li>{{FEATURE_2}}</li>
</ul>

<div style="background:#fff9e6;border-left:4px solid #f39c12;padding:15px;margin:20px 0;border-radius:4px;">
  <strong>🔍 Condition Notes:</strong> {{CONDITION_DETAILS}}
</div>

<h3 style="color:#333;">🚚 Shipping</h3>
<p>Shipped in original or protective packaging. Tracked delivery. Returns accepted — please contact us first before returning.</p>

<p style="font-size:12px;color:#777;margin-top:20px;">Installation should be carried out by a qualified mechanic. We are not responsible for damage caused by incorrect fitting.</p>`),
  },
];

export function applyTemplate(template: ListingTemplate, replacements: Record<string, string> = {}): string {
  let html = template.htmlTemplate;
  const defaults: Record<string, string> = {
    PRODUCT_NAME: template.name + " Product",
    BRAND: "Brand",
    MODEL: "Model",
    STORAGE: "N/A",
    COLOUR: "See photos",
    CONDITION: "Good",
    CONDITION_DETAILS: "Please see photos for full condition assessment.",
    NETWORK: "Unlocked",
    ACCESSORIES: "As shown in photos",
    FEATURE_1: "High quality item",
    FEATURE_2: "Fast dispatch",
    FEATURE_3: "30-day returns",
    FEATURE_4: "Great value",
    BENEFIT_1: "Premium quality",
    BENEFIT_2: "Fast-acting formula",
    BENEFIT_3: "Dermatologically tested",
    SHIPPING_INFO: "Standard tracked delivery",
    FULL_DESCRIPTION: "Please see photos and ask any questions before purchasing.",
    SIZE: "See listing",
    SIZE_GUIDE: "Please check measurements carefully before ordering.",
    MATERIAL: "See manufacturer specs",
    STYLE: "Classic",
    ERA: "Modern",
    ORIGIN: "United Kingdom",
    RARITY: "Standard",
    PROVENANCE: "Purchased in the UK. No COA unless stated.",
    SPORT: "Multi-sport",
    SET_NUMBER: "See title",
    AGE_RANGE: "3+",
    YEAR: "See listing",
    COMPLETENESS: "Complete — see photos",
    CONTENTS: "As shown in photos",
    SHADE: "See title",
    EXPIRY: "Check photos",
    TYPE: "General",
    DIMENSIONS: "See description",
    WEIGHT: "See listing",
    COMPATIBLE_VEHICLES: "Please check compatibility before purchasing",
    PART_NUMBER: "See title",
    OEM: "OEM Equivalent",
    WARRANTY: "3 months",
    SPORT_TYPE: "General",
  };
  const merged = { ...defaults, ...replacements };
  for (const [key, value] of Object.entries(merged)) {
    html = html.replaceAll(`{{${key}}}`, value);
  }
  return html;
}
