/* Built-in templates and suggestions for the wedding planner */
window.WP = {
  // Suggested share of the total budget (percentages add up to 100).
  // Each item is [name, relative weight] used when suggesting estimates within a category.
  CATEGORIES: [
    { name: "Venue & Rentals", pct: 25, color: "#1F3A33", items: [
      ["Ceremony venue fee", 15], ["Reception venue fee", 50], ["Tables, chairs & linens rental", 12], ["Tent or weather backup", 8], ["Dance floor / staging", 5], ["Venue service charge & tax", 7], ["Cleanup / security fee", 3] ] },
    { name: "Catering, Bar & Cake", pct: 22, color: "#3E6B5C", items: [
      ["Catering (per guest)", 60], ["Bar service & alcohol", 20], ["Wedding cake / desserts", 8], ["Cake cutting fee", 1], ["Service staff gratuity", 6], ["Late-night snack", 3], ["Vendor meals", 2] ] },
    { name: "Photography & Video", pct: 12, color: "#8FA89A", items: [
      ["Photographer", 60], ["Videographer", 30], ["Engagement photo session", 4], ["Album & prints", 4], ["Photo booth", 8] ] },
    { name: "Attire & Beauty", pct: 8, color: "#C2A36B", items: [
      ["Wedding dress / gown", 40], ["Alterations", 8], ["Veil, jewelry & accessories", 8], ["Shoes", 4], ["Suit or tuxedo", 14], ["Hair & makeup (wedding day)", 20], ["Hair & makeup trial", 4] ] },
    { name: "Flowers & Decor", pct: 8, color: "#B5566A", items: [
      ["Bridal bouquet", 12], ["Wedding party bouquets", 12], ["Boutonnieres & corsages", 6], ["Ceremony florals / arch", 20], ["Centerpieces", 35], ["Candles & lighting", 10], ["Signage & welcome sign", 5] ] },
    { name: "Music & Entertainment", pct: 7, color: "#5C4B6B", items: [
      ["DJ or band", 75], ["Ceremony musicians", 15], ["Sound system & microphones", 7], ["Dance lessons", 3] ] },
    { name: "Wedding Planner", pct: 3, color: "#6D8196", items: [
      ["Planner or day-of coordinator", 1] ] },
    { name: "Rings", pct: 3, color: "#A68A4E", items: [
      ["Wedding band (partner 1)", 45], ["Wedding band (partner 2)", 45], ["Engraving & sizing", 5], ["Ring insurance", 5] ] },
    { name: "Stationery & Postage", pct: 2, color: "#7E9C8F", items: [
      ["Save-the-dates", 15], ["Invitations & RSVP cards", 45], ["Postage", 15], ["Programs, menus & place cards", 15], ["Thank-you cards", 10] ] },
    { name: "Transportation", pct: 2, color: "#4F6D7A", items: [
      ["Wedding party transportation", 45], ["Guest shuttle", 30], ["Getaway car", 15], ["Parking / valet", 10] ] },
    { name: "Gifts & Favors", pct: 2, color: "#C98B7E", items: [
      ["Wedding party gifts", 35], ["Parent gifts", 20], ["Guest favors", 25], ["Welcome bags", 20] ] },
    { name: "Ceremony & Legal", pct: 1, color: "#88806F", items: [
      ["Marriage license", 20], ["Officiant fee or donation", 70], ["Name change documents", 10] ] },
    { name: "Contingency", pct: 5, color: "#9A9A93", items: [
      ["Vendor tips", 40], ["Overtime charges", 20], ["Emergency fund", 40] ] },
    { name: "Honeymoon", pct: 0, color: "#5E8C8C", items: [
      ["Flights", 40], ["Lodging", 45], ["Activities & excursions", 15] ] },
  ],

  // Rough rules of thumb for estimating total cost per guest (US averages, all-in).
  BUDGET_TIERS: [
    { key: "simple", label: "Simple & budget-friendly", perGuest: 150 },
    { key: "moderate", label: "Moderate", perGuest: 250 },
    { key: "upscale", label: "Upscale", perGuest: 400 },
    { key: "luxury", label: "Luxury", perGuest: 650 },
  ],

  // "months" or "days" = complete-by offset before the wedding date
  PHASES: [
    { key: "12", label: "12+ months out", months: 12 },
    { key: "9", label: "9 to 12 months out", months: 9 },
    { key: "6", label: "6 to 9 months out", months: 6 },
    { key: "4", label: "4 to 6 months out", months: 4 },
    { key: "2", label: "2 to 3 months out", months: 2 },
    { key: "1", label: "1 month out", months: 1 },
    { key: "2w", label: "2 weeks out", days: 14 },
    { key: "week", label: "Week of the wedding", days: 2 },
    { key: "day", label: "Wedding day", days: 0 },
    { key: "after", label: "After the wedding", days: -60 },
  ],

  TASKS: {
    "12": [
      "Talk about your vision, priorities and must-haves",
      "Agree on a total budget and who is contributing",
      "Draft a rough guest list and head count",
      "Pick a few possible dates and a season",
      "Research and tour venues",
      "Book the ceremony and reception venues",
      "Decide whether to hire a planner or day-of coordinator",
      "Choose your wedding party",
      "Start a wedding email account and shared folder",
      "Consider wedding insurance",
    ],
    "9": [
      "Book the photographer",
      "Book the videographer",
      "Book the caterer (if not provided by the venue)",
      "Book the DJ or band",
      "Book the officiant",
      "Start shopping for the dress or attire",
      "Create a wedding website",
      "Reserve hotel room blocks for guests",
      "Take engagement photos",
      "Send save-the-dates (especially for destination weddings)",
    ],
    "6": [
      "Book the florist",
      "Book hair and makeup artists",
      "Order the wedding dress (allow time for alterations)",
      "Set up your gift registry",
      "Plan and book the honeymoon",
      "Choose wedding party attire",
      "Book rentals: tables, chairs, linens, tent",
      "Book transportation",
      "Send save-the-dates (if not sent yet)",
    ],
    "4": [
      "Order invitations and stationery",
      "Schedule cake tastings and order the cake",
      "Book the rehearsal dinner venue",
      "Buy wedding rings",
      "Order suits or tuxedos",
      "Plan the ceremony structure and readings",
      "Check passport expiry for the honeymoon",
      "Schedule a hair and makeup trial",
    ],
    "2": [
      "Mail invitations (6 to 8 weeks before)",
      "Finalize the menu with the caterer",
      "Choose ceremony and first-dance music",
      "Write or finalize your vows",
      "Buy gifts for the wedding party and parents",
      "Schedule dress fittings",
      "Order favors and welcome bags",
      "Confirm all vendor contracts and payment dates",
      "Prepare marriage paperwork (Alabama: complete the state Marriage Certificate form)",
    ],
    "1": [
      "Follow up on missing RSVPs",
      "Give the final head count to caterer and venue",
      "Create the seating chart",
      "Write the day-of timeline and share it with vendors",
      "Final dress fitting",
      "Break in your wedding shoes",
      "Prepare vendor tip envelopes",
      "Send the shot list to the photographer",
      "Confirm transportation pickup times and addresses",
    ],
    "2w": [
      "Confirm arrival times with every vendor",
      "Print place cards, programs and menus",
      "Assign day-of jobs to family and friends",
      "Get haircuts and any beauty treatments",
      "Pack for the honeymoon",
    ],
    "week": [
      "Pick up the dress and attire",
      "Deliver decor, favors and signage to the venue",
      "Pack a wedding day emergency kit",
      "Attend the rehearsal and rehearsal dinner",
      "Hand rings, marriage paperwork and tip envelopes to a trusted person",
      "Get a good night's sleep",
    ],
    "day": [
      "Eat a real breakfast and stay hydrated",
      "Give vendor final payments and tips to the coordinator",
      "Take a moment together before the reception",
      "Sign the marriage certificate form before an Alabama notary, if not done yet",
    ],
    "after": [
      "Return rentals and borrowed items",
      "File the notarized marriage certificate with the probate office (Alabama: within 30 days of signing)",
      "Preserve the dress and bouquet",
      "Write and mail thank-you notes",
      "Update your name on ID, bank and accounts (if changing)",
      "Leave reviews for your vendors",
      "Order your album and prints",
    ],
  },

  TIMELINE: [
    { time: "08:00", title: "Hair and makeup begins", location: "Getting-ready suite", who: "Wedding party, stylists" },
    { time: "11:30", title: "Photographer arrives for detail shots", location: "Getting-ready suite", who: "Photographer" },
    { time: "12:30", title: "Lunch for the wedding party", location: "Getting-ready suite", who: "Wedding party" },
    { time: "13:00", title: "Get dressed", location: "Getting-ready suite", who: "Couple, wedding party" },
    { time: "13:45", title: "First look and couple portraits", location: "", who: "Couple, photographer" },
    { time: "14:30", title: "Wedding party and family photos", location: "", who: "Family, wedding party" },
    { time: "15:30", title: "Guests arrive", location: "Ceremony site", who: "Ushers" },
    { time: "16:00", title: "Ceremony", location: "Ceremony site", who: "Everyone" },
    { time: "16:30", title: "Cocktail hour", location: "", who: "Guests" },
    { time: "17:30", title: "Grand entrance", location: "Reception", who: "Couple, wedding party, DJ" },
    { time: "17:40", title: "First dance", location: "Reception", who: "Couple" },
    { time: "17:50", title: "Welcome and blessing", location: "Reception", who: "" },
    { time: "18:00", title: "Dinner service", location: "Reception", who: "Caterer" },
    { time: "18:45", title: "Toasts", location: "Reception", who: "Best man, maid of honor, parents" },
    { time: "19:15", title: "Parent dances", location: "Reception", who: "" },
    { time: "19:30", title: "Cake cutting", location: "Reception", who: "Couple" },
    { time: "19:40", title: "Open dancing", location: "Reception", who: "DJ or band" },
    { time: "20:30", title: "Bouquet and garter toss", location: "Reception", who: "" },
    { time: "21:45", title: "Last dance", location: "Reception", who: "" },
    { time: "22:00", title: "Send-off", location: "Venue entrance", who: "Everyone" },
  ],

  VENDOR_CATEGORIES: [
    "Venue", "Caterer", "Photographer", "Videographer", "DJ / Band", "Florist", "Officiant",
    "Hair & Makeup", "Bakery", "Planner / Coordinator", "Rentals", "Transportation",
    "Stationery", "Attire", "Jeweler", "Lodging", "Other",
  ],

  // Vendors most couples need to book
  ESSENTIAL_VENDORS: ["Venue", "Caterer", "Photographer", "Officiant", "DJ / Band", "Florist", "Hair & Makeup", "Bakery"],

  VENDOR_STATUSES: ["Researching", "Contacted", "Meeting set", "Booked", "Not a fit"],

  VENDOR_QUESTIONS: {
    "Venue": [
      "Is our date available, and how long can you hold it?",
      "What is included: tables, chairs, linens, setup, cleanup?",
      "Is there a required caterer or preferred vendor list?",
      "What's the rain or weather backup plan?",
      "What is the maximum capacity, seated and standing?",
      "Are there noise curfews or decor restrictions (candles, confetti)?",
      "Are service charges, tax and gratuity included in the quote?",
      "What's the cancellation and postponement policy?",
    ],
    "Caterer": [
      "What is the per-guest price, and what does it include?",
      "Is a tasting included, and when can we schedule it?",
      "How do you handle allergies and dietary restrictions?",
      "What is the staff-to-guest ratio?",
      "Are service charge and gratuity included?",
      "Do you provide plates, glassware and linens?",
      "When do you need the final head count?",
    ],
    "Photographer": [
      "Can we see full galleries from weddings like ours?",
      "How many hours are included, and what does overtime cost?",
      "Is a second shooter included?",
      "When will we receive photos, and in what format?",
      "Do we get printing rights?",
      "What's your backup plan if you're sick?",
    ],
    "DJ / Band": [
      "Can we provide a must-play and do-not-play list?",
      "Do you also act as MC for announcements?",
      "Do you provide ceremony sound and microphones?",
      "How much space and power do you need?",
      "What's included for breaks and overtime?",
    ],
    "Florist": [
      "Which flowers are in season for our date?",
      "Can you repurpose ceremony flowers at the reception?",
      "Do you handle delivery, setup and teardown?",
      "Do you rent vases, arches or other structures?",
    ],
    "Hair & Makeup": [
      "Is a trial included in the price?",
      "How many people can you style, and how long per person?",
      "Do you travel to our location, and is there a travel fee?",
      "What products do you use for long wear and photos?",
    ],
    "Officiant": [
      "Are you legally able to officiate in our state?",
      "Will you attend the rehearsal?",
      "Can we customize the ceremony and vows?",
      "Do you file the marriage license after the ceremony?",
    ],
  },

  // Commonly forgotten costs, with the category they belong in
  FORGOTTEN: [
    { name: "Service charges and sales tax", category: "Venue & Rentals", note: "Often 20 to 30% on top of catering and venue quotes." },
    { name: "Vendor tips", category: "Contingency", note: "Set aside cash envelopes for each vendor team." },
    { name: "Vendor meals", category: "Catering, Bar & Cake", note: "Photographers, DJs and coordinators usually need a meal." },
    { name: "Alterations", category: "Attire & Beauty", note: "Dress alterations can run several hundred dollars." },
    { name: "Postage for invitations", category: "Stationery & Postage", note: "Heavier or square envelopes cost more to mail." },
    { name: "Marriage license", category: "Ceremony & Legal", note: "In Alabama this is a probate recording fee for the marriage certificate. Fees vary by county." },
    { name: "Cake cutting fee", category: "Catering, Bar & Cake", note: "Charged by some venues when the cake is outside." },
    { name: "Overtime charges", category: "Contingency", note: "Photographers, DJs and venues bill by the hour past contract." },
    { name: "Hair and makeup trial", category: "Attire & Beauty", note: "Usually priced separately from the wedding day." },
    { name: "Wedding insurance", category: "Contingency", note: "Covers cancellations, vendor no-shows and liability." },
    { name: "Rehearsal dinner", category: "Catering, Bar & Cake", note: "Budget for it even if family is hosting part." },
    { name: "Welcome bags delivery fee", category: "Gifts & Favors", note: "Hotels may charge per bag to hand them out." },
    { name: "Day-after brunch", category: "Catering, Bar & Cake", note: "Optional, but a common add-on for out-of-town guests." },
    { name: "Dress cleaning and preservation", category: "Attire & Beauty", note: "Plan for it after the wedding." },
  ],

  SAVING_TIPS: [
    "Choose a Friday, Sunday or off-season date. Venues often discount 20 to 40%.",
    "Trim the guest list first. Every guest affects catering, rentals, stationery and favors.",
    "Pick a venue that includes tables, chairs and linens to cut rental costs.",
    "Serve a signature cocktail plus beer and wine instead of a full open bar.",
    "Use seasonal, local flowers and move ceremony florals to the reception.",
    "Order a small display cake for cutting and serve sheet cake from the kitchen.",
    "Send digital save-the-dates and keep printed invitations simple.",
    "Book a photographer for fewer hours and skip the getting-ready coverage.",
    "Rent or buy a pre-owned dress, and borrow accessories.",
    "Skip favors. Most guests leave them behind.",
    "Hold ceremony and reception at the same venue to avoid transport costs.",
    "Ask vendors about package pricing when you book more than one service.",
  ],

  // Common US tipping guidance
  TIPPING: [
    { who: "Hair and makeup artists", amount: "15 to 25% of the service" },
    { who: "Catering and wait staff", amount: "15 to 20% if gratuity isn't already in the contract" },
    { who: "Bartenders", amount: "10 to 15% of the bar bill, split among staff" },
    { who: "DJ", amount: "$50 to $150" },
    { who: "Band or ceremony musicians", amount: "$25 to $50 per musician" },
    { who: "Photographer and videographer", amount: "$50 to $200 per person (optional for studio owners)" },
    { who: "Delivery and setup crews", amount: "$20 to $50 per person" },
    { who: "Drivers", amount: "15 to 20% of the transportation bill" },
    { who: "Officiant", amount: "$50 to $100, or a donation to their congregation" },
    { who: "Planner or coordinator", amount: "10 to 20% or a thoughtful gift (optional)" },
  ],

  KIT: [
    "Safety pins and bobby pins", "Sewing kit with matching thread", "Stain remover pen", "Pain reliever",
    "Band-aids and blister pads", "Tissues and blotting papers", "Deodorant", "Breath mints",
    "Phone charger", "Lint roller", "Double-sided fashion tape", "Snacks and water",
    "Hairspray and extra makeup", "Clear nail polish", "Small scissors", "Umbrella",
    "Copy of the day-of timeline and vendor phone numbers", "Tip envelopes and marriage license",
  ],
};

/* North Alabama wedding resources.
   Gathered from public websites in September 2026. Not endorsements; confirm details directly.
   area: "shoals" (Florence, Muscle Shoals, Sheffield, Tuscumbia), "huntsville" (Huntsville, Madison), "region" (serves much of North Alabama)
   category must match a VENDOR_CATEGORIES value so it can be saved to the Vendors list. */
window.WP.LOCAL = {
  updated: "September 2026",
  areas: [
    { key: "shoals", label: "The Shoals" },
    { key: "huntsville", label: "Huntsville & Madison" },
    { key: "region", label: "Across North Alabama" },
  ],
  vendors: [
    // Venues
    { name: "Pickett Place & Pickett On Court", category: "Venue", area: "shoals", city: "Florence",
      phone: "256-668-1777", url: "https://www.pickettplaceevents.com/",
      note: "Historic downtown estate with courtyards, bridal suites and indoor or outdoor ceremonies. Its sister venue, Pickett On Court, is an industrial-style space on Court Street." },
    { name: "Renaissance Shoals Resort & Spa", category: "Venue", area: "shoals", city: "Florence",
      url: "https://www.theknot.com/marketplace/renaissance-shoals-resort-and-spa-florence-al-205114", urlLabel: "Listing on The Knot",
      note: "Riverfront resort hotel with ballrooms and guest rooms overlooking the Tennessee River." },
    { name: "Joe Wheeler State Park Lodge", category: "Venue", area: "shoals", city: "Rogersville",
      phone: "256-247-5461", url: "https://www.alapark.com/parks/joe-wheeler-state-park/weddings",
      note: "State park lodge on Wheeler Lake with indoor rooms, a patio, catering, and rooms for the wedding party and guests." },
    { name: "Burritt on the Mountain", category: "Venue", area: "huntsville", city: "Huntsville",
      phone: "256-536-2882", url: "https://burrittonthemountain.com/rent/weddings/",
      note: "Mountaintop grounds with a 1930s mansion, a historic church, a gazebo overlook and the Baron Bluff reception hall." },
    { name: "Huntsville Botanical Garden", category: "Venue", area: "huntsville", city: "Huntsville",
      email: "rentals@hsvbg.org", url: "https://hsvbg.org/private-events/weddings/",
      note: "Several garden and indoor spaces with full wedding packages, plus small walk-in ceremonies." },

    // Photo and video
    { name: "The Rose Reflective Photography", category: "Photographer", area: "shoals", city: "Florence",
      url: "https://www.therosereflective.com/",
      note: "Wedding and elopement photographer who also writes guides to Shoals venues." },
    { name: "Keelan Walker Photography", category: "Photographer", area: "shoals", city: "Florence",
      url: "https://keelanwalkerphotography.com/",
      note: "Portrait studio that photographs weddings." },
    { name: "Joel & Amber Photography", category: "Photographer", area: "huntsville", city: "Huntsville",
      url: "https://joelandamberphotography.com/",
      note: "Husband and wife team with detailed guides to Huntsville venues." },
    { name: "Abby Satterfield Photography", category: "Photographer", area: "region", city: "North Alabama",
      url: "https://abbysatterfieldphotography.com/",
      note: "Covers Huntsville, Decatur, Athens, Guntersville, Florence and Muscle Shoals." },
    { name: "REG Wedding Films", category: "Videographer", area: "shoals", city: "Muscle Shoals",
      phone: "256-324-1864", url: "https://www.regweddingfilms.com/",
      note: "Wedding films across the Shoals and North Alabama. Travel is included for most weddings within about 60 miles." },

    // Flowers
    { name: "Dean's Florist", category: "Florist", area: "shoals", city: "Florence",
      phone: "256-766-6622", url: "https://deansfloristflorenceal.com/",
      note: "Family-owned since 1986 and delivers to many Shoals venues." },
    { name: "Greenhill Florist & Gifts", category: "Florist", area: "shoals", city: "Florence",
      phone: "256-757-1709", url: "https://www.greenhillfloristandgifts.com/wedding-flowers",
      note: "Wedding flowers for Florence, Killen, Rogersville and the rest of the Shoals." },
    { name: "Will & Dee's Florist", category: "Florist", area: "shoals", city: "Florence",
      url: "https://willanddeesflorist.net/",
      note: "Local florist delivering across Florence, Muscle Shoals, Sheffield and Tuscumbia." },

    // Cake
    { name: "Nothing Bundt Cakes (Huntsville)", category: "Bakery", area: "huntsville", city: "Huntsville",
      phone: "256-585-2023", url: "https://www.nothingbundtcakes.com/find-a-bakery/al/huntsville/wedding-cakes-48.html",
      note: "Bundt wedding cakes, plus mini Bundtlets for favors and showers." },
    { name: "Peggy Ann Bakery", category: "Bakery", area: "huntsville", city: "Huntsville",
      phone: "256-536-8541", url: "https://www.weddingwire.com/biz/peggy-ann-bakery-huntsville/d2bdeb1a356f0680.html", urlLabel: "Listing on WeddingWire",
      note: "Long-running local bakery offering custom wedding cakes." },

    // Music
    { name: "Fine Era Productions", category: "DJ / Band", area: "shoals", city: "Florence",
      phone: "256-333-6444", url: "https://www.weddingwire.com/biz/fine-era-productions-muscle-shoals/a1272917678d6231.html", urlLabel: "Listing on WeddingWire",
      note: "DJ and MC, event lighting and photo booth." },
    { name: "Rocket Entertainment", category: "DJ / Band", area: "shoals", city: "Florence and the Shoals",
      url: "https://www.rocket-entertainment.com/wedding-dj-florence-the-shoals-alabama/",
      note: "DJ and emcee packages with uplighting, photo booth and cold sparklers." },
    { name: "Metropolitan Disc Jockey", category: "DJ / Band", area: "region", city: "Florence and Huntsville",
      phone: "256-533-6065", url: "https://www.metropolitandiscjockey.com/locations/florence-al",
      note: "DJ team that works Shoals and Huntsville weddings." },
    { name: "Brian Anderson Entertainment", category: "DJ / Band", area: "huntsville", city: "Huntsville",
      url: "https://www.djbriananderson.com/",
      note: "Wedding DJ at many Huntsville venues." },

    // Attire
    { name: "La Mariée Bridal Salon", category: "Attire", area: "huntsville", city: "Huntsville",
      phone: "256-836-7227", url: "https://lamarieebridalsalon.com/",
      note: "Designer bridal gowns by appointment." },
    { name: "Birch On Main", category: "Attire", area: "huntsville", city: "Huntsville",
      phone: "256-270-8895", url: "https://www.birchonmain.com/",
      note: "Bridal gowns, tuxedos and mother-of-the-bride dresses." },
    { name: "Modern Brides", category: "Attire", area: "huntsville", city: "Huntsville",
      phone: "256-533-9333", url: "https://www.modernbridesinc.com/",
      note: "Bridal, prom and tuxedo boutique. Appointments Monday through Saturday." },
    { name: "Amari Bridal", category: "Attire", area: "huntsville", city: "Huntsville",
      phone: "256-795-6811", url: "https://amaribridal.com/",
      note: "Discounted designer gowns you can take home the same day. Good for short engagements." },
    { name: "David's Bridal (Huntsville)", category: "Attire", area: "huntsville", city: "Huntsville",
      url: "https://www.davidsbridal.com/stores/huntsville-al-358061711-0209",
      note: "Wide size range, bridesmaid dresses and on-site alterations." },

    // Rentals
    { name: "Huntsville Event Rentals", category: "Rentals", area: "huntsville", city: "Huntsville",
      url: "https://www.huntsvilleeventrentals.com/",
      note: "Tents, tables, chairs, linens, lighting and wedding arches, with posted package prices." },
  ],

  directories: [
    { name: "Florence / Muscle Shoals vendor guide", source: "Build A Bride", url: "https://buildabride.com/pages/florence-muscle-shoals-vendor-guide" },
    { name: "Muscle Shoals wedding venues", source: "The Knot", url: "https://www.theknot.com/marketplace/wedding-reception-venues-muscle-shoals-al" },
    { name: "Muscle Shoals wedding photographers", source: "The Knot", url: "https://www.theknot.com/marketplace/wedding-photographers-muscle-shoals-al" },
    { name: "Muscle Shoals wedding DJs", source: "The Knot", url: "https://www.theknot.com/marketplace/wedding-djs-muscle-shoals-al" },
    { name: "Small event venues in Huntsville", source: "Huntsville/Madison County CVB", url: "https://www.huntsville.org/blog/list/post/small-event-venues-in-huntsville-al/" },
    { name: "Huntsville wedding venues by category", source: "Sarah Mismash Photography", url: "https://sarahmismashphotography.com/blog/guide-to-huntsville-alabamas-wedding-venues-categories/" },
  ],

  marriage: {
    summary: "Alabama stopped issuing marriage licenses on August 29, 2019. Instead, you both fill out the state's Alabama Marriage Certificate form, sign it in front of an Alabama notary, and deliver it with the recording fee to a county probate office within 30 days of the later signature. The probate office records it, and that recorded form is your proof of marriage.",
    links: [
      { name: "Marriage Certificate forms and instructions", source: "Alabama Department of Public Health", url: "https://www.alabamapublichealth.gov/vitalrecords/marriage-certificates.html" },
      { name: "Lauderdale County probate office (Florence)", source: "Recording fee listed as $73", url: "https://www.lauderdalecountyal.gov/home/departments/probate-office/marriage-certificates/" },
      { name: "Madison County probate office (Huntsville)", source: "Fee listed as $89; typed forms only", url: "https://www.madisoncountyal.gov/departments/probate-judge/areas-of-service/marriage-licenses" },
    ],
  },
};
