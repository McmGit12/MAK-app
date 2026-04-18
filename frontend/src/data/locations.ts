export interface LocationData {
  [country: string]: {
    [state: string]: string[];
  };
}

const LOCATIONS: LocationData = {
  'United States': {
    'California': ['Los Angeles', 'San Francisco', 'San Diego', 'Sacramento'],
    'New York': ['New York City', 'Buffalo', 'Albany', 'Rochester'],
    'Texas': ['Houston', 'Dallas', 'Austin', 'San Antonio'],
    'Florida': ['Miami', 'Orlando', 'Tampa', 'Jacksonville'],
    'Illinois': ['Chicago', 'Springfield', 'Naperville', 'Rockford'],
  },
  'United Kingdom': {
    'England': ['London', 'Manchester', 'Birmingham', 'Liverpool'],
    'Scotland': ['Edinburgh', 'Glasgow', 'Aberdeen', 'Dundee'],
    'Wales': ['Cardiff', 'Swansea', 'Newport', 'Bangor'],
    'Northern Ireland': ['Belfast', 'Derry', 'Lisburn', 'Newry'],
  },
  'India': {
    'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Nashik'],
    'Delhi': ['New Delhi', 'Noida', 'Gurgaon', 'Faridabad'],
    'Karnataka': ['Bangalore', 'Mysore', 'Mangalore', 'Hubli'],
    'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Salem'],
    'West Bengal': ['Kolkata', 'Howrah', 'Siliguri', 'Durgapur'],
  },
  'France': {
    'Ile-de-France': ['Paris', 'Versailles', 'Boulogne', 'Saint-Denis'],
    'Provence-Alpes': ['Marseille', 'Nice', 'Cannes', 'Aix-en-Provence'],
    'Auvergne-Rhone-Alpes': ['Lyon', 'Grenoble', 'Saint-Etienne', 'Annecy'],
    'Nouvelle-Aquitaine': ['Bordeaux', 'Limoges', 'Poitiers', 'La Rochelle'],
  },
  'Italy': {
    'Lazio': ['Rome', 'Tivoli', 'Viterbo', 'Latina'],
    'Lombardy': ['Milan', 'Bergamo', 'Brescia', 'Como'],
    'Tuscany': ['Florence', 'Pisa', 'Siena', 'Lucca'],
    'Veneto': ['Venice', 'Verona', 'Padua', 'Vicenza'],
    'Campania': ['Naples', 'Salerno', 'Caserta', 'Amalfi'],
  },
  'Japan': {
    'Kanto': ['Tokyo', 'Yokohama', 'Kawasaki', 'Saitama'],
    'Kansai': ['Osaka', 'Kyoto', 'Kobe', 'Nara'],
    'Hokkaido': ['Sapporo', 'Hakodate', 'Asahikawa', 'Otaru'],
    'Chubu': ['Nagoya', 'Kanazawa', 'Niigata', 'Shizuoka'],
  },
  'Australia': {
    'New South Wales': ['Sydney', 'Newcastle', 'Wollongong', 'Byron Bay'],
    'Victoria': ['Melbourne', 'Geelong', 'Ballarat', 'Bendigo'],
    'Queensland': ['Brisbane', 'Gold Coast', 'Cairns', 'Sunshine Coast'],
    'Western Australia': ['Perth', 'Fremantle', 'Broome', 'Margaret River'],
  },
  'Germany': {
    'Bavaria': ['Munich', 'Nuremberg', 'Augsburg', 'Regensburg'],
    'Berlin': ['Berlin', 'Potsdam'],
    'North Rhine-Westphalia': ['Cologne', 'Dusseldorf', 'Dortmund', 'Essen'],
    'Hamburg': ['Hamburg', 'Altona', 'Bergedorf'],
  },
  'Canada': {
    'Ontario': ['Toronto', 'Ottawa', 'Hamilton', 'Niagara Falls'],
    'British Columbia': ['Vancouver', 'Victoria', 'Whistler', 'Kelowna'],
    'Quebec': ['Montreal', 'Quebec City', 'Gatineau', 'Laval'],
    'Alberta': ['Calgary', 'Edmonton', 'Banff', 'Jasper'],
  },
  'Brazil': {
    'Sao Paulo': ['Sao Paulo', 'Campinas', 'Santos', 'Guarulhos'],
    'Rio de Janeiro': ['Rio de Janeiro', 'Niteroi', 'Petropolis', 'Buzios'],
    'Bahia': ['Salvador', 'Porto Seguro', 'Ilheus', 'Feira de Santana'],
    'Minas Gerais': ['Belo Horizonte', 'Ouro Preto', 'Uberlandia', 'Juiz de Fora'],
  },
  'Spain': {
    'Madrid': ['Madrid', 'Alcala de Henares', 'Getafe', 'Leganes'],
    'Catalonia': ['Barcelona', 'Girona', 'Tarragona', 'Sitges'],
    'Andalusia': ['Seville', 'Malaga', 'Granada', 'Cordoba'],
    'Valencia': ['Valencia', 'Alicante', 'Benidorm', 'Elche'],
  },
  'Mexico': {
    'Mexico City': ['Mexico City', 'Coyoacan', 'Polanco', 'Roma Norte'],
    'Quintana Roo': ['Cancun', 'Playa del Carmen', 'Tulum', 'Cozumel'],
    'Jalisco': ['Guadalajara', 'Puerto Vallarta', 'Zapopan', 'Tlaquepaque'],
    'Baja California Sur': ['Cabo San Lucas', 'La Paz', 'San Jose del Cabo', 'Loreto'],
  },
  'Thailand': {
    'Bangkok': ['Bangkok', 'Nonthaburi', 'Samut Prakan'],
    'Chiang Mai': ['Chiang Mai', 'Chiang Rai', 'Pai'],
    'Phuket': ['Phuket Town', 'Patong', 'Kata Beach', 'Kamala'],
    'Krabi': ['Krabi Town', 'Ao Nang', 'Railay Beach', 'Koh Lanta'],
  },
  'UAE': {
    'Dubai': ['Dubai', 'Dubai Marina', 'Downtown Dubai', 'Jumeirah'],
    'Abu Dhabi': ['Abu Dhabi', 'Al Ain', 'Saadiyat Island', 'Yas Island'],
    'Sharjah': ['Sharjah', 'Khor Fakkan', 'Al Dhaid'],
  },
  'Singapore': {
    'Central': ['Marina Bay', 'Orchard Road', 'Chinatown', 'Clarke Quay'],
    'East': ['Changi', 'Katong', 'Tampines', 'Bedok'],
    'West': ['Jurong', 'Sentosa', 'Bukit Timah', 'Clementi'],
  },
  'South Korea': {
    'Seoul Capital': ['Seoul', 'Incheon', 'Suwon', 'Seongnam'],
    'Gyeongsang': ['Busan', 'Daegu', 'Gyeongju', 'Ulsan'],
    'Jeju': ['Jeju City', 'Seogwipo', 'Hallasan', 'Udo Island'],
  },
  'Turkey': {
    'Istanbul': ['Istanbul', 'Kadikoy', 'Besiktas', 'Uskudar'],
    'Antalya': ['Antalya', 'Side', 'Alanya', 'Kemer'],
    'Cappadocia': ['Goreme', 'Urgup', 'Nevsehir', 'Avanos'],
    'Izmir': ['Izmir', 'Cesme', 'Kusadasi', 'Ephesus'],
  },
  'Greece': {
    'Attica': ['Athens', 'Piraeus', 'Glyfada', 'Vouliagmeni'],
    'Cyclades': ['Santorini', 'Mykonos', 'Naxos', 'Paros'],
    'Crete': ['Heraklion', 'Chania', 'Rethymno', 'Agios Nikolaos'],
    'Thessaloniki': ['Thessaloniki', 'Halkidiki', 'Katerini'],
  },
  'Indonesia': {
    'Bali': ['Ubud', 'Seminyak', 'Kuta', 'Denpasar'],
    'Java': ['Jakarta', 'Yogyakarta', 'Surabaya', 'Bandung'],
    'Lombok': ['Mataram', 'Senggigi', 'Kuta Lombok', 'Gili Islands'],
  },
  'South Africa': {
    'Western Cape': ['Cape Town', 'Stellenbosch', 'Franschhoek', 'Hermanus'],
    'Gauteng': ['Johannesburg', 'Pretoria', 'Soweto', 'Sandton'],
    'KwaZulu-Natal': ['Durban', 'Umhlanga', 'Ballito', 'Pietermaritzburg'],
  },
  'Egypt': {
    'Cairo': ['Cairo', 'Giza', 'Heliopolis', 'Maadi'],
    'Red Sea': ['Hurghada', 'Sharm El Sheikh', 'Marsa Alam', 'Dahab'],
    'Luxor': ['Luxor', 'Karnak', 'Valley of Kings', 'Aswan'],
  },
  'Switzerland': {
    'Zurich': ['Zurich', 'Winterthur', 'Baden'],
    'Bern': ['Bern', 'Interlaken', 'Thun', 'Grindelwald'],
    'Geneva': ['Geneva', 'Lausanne', 'Montreux', 'Nyon'],
    'Valais': ['Zermatt', 'Verbier', 'Sion', 'Crans-Montana'],
  },
  'Netherlands': {
    'North Holland': ['Amsterdam', 'Haarlem', 'Zaandam', 'Alkmaar'],
    'South Holland': ['Rotterdam', 'The Hague', 'Leiden', 'Delft'],
    'Utrecht': ['Utrecht', 'Amersfoort', 'Zeist'],
  },
  'Portugal': {
    'Lisbon': ['Lisbon', 'Sintra', 'Cascais', 'Setubal'],
    'Porto': ['Porto', 'Braga', 'Guimaraes', 'Aveiro'],
    'Algarve': ['Faro', 'Lagos', 'Albufeira', 'Tavira'],
  },
  'Sweden': {
    'Stockholm': ['Stockholm', 'Sodermalm', 'Gamla Stan', 'Uppsala'],
    'Vastra Gotaland': ['Gothenburg', 'Boras', 'Trollhattan'],
    'Skane': ['Malmo', 'Lund', 'Helsingborg', 'Ystad'],
  },
  'New Zealand': {
    'Auckland': ['Auckland', 'Manukau', 'North Shore', 'Waitakere'],
    'Canterbury': ['Christchurch', 'Akaroa', 'Kaikoura', 'Hanmer Springs'],
    'Otago': ['Queenstown', 'Dunedin', 'Wanaka', 'Oamaru'],
  },
  'China': {
    'Beijing': ['Beijing', 'Great Wall Area', 'Forbidden City Area'],
    'Shanghai': ['Shanghai', 'Pudong', 'Bund Area', 'French Concession'],
    'Guangdong': ['Guangzhou', 'Shenzhen', 'Zhuhai', 'Dongguan'],
    'Sichuan': ['Chengdu', 'Leshan', 'Jiuzhaigou', 'Mount Emei'],
  },
  'Russia': {
    'Moscow': ['Moscow', 'Krasnogorsk', 'Podolsk', 'Khimki'],
    'St. Petersburg': ['St. Petersburg', 'Peterhof', 'Pushkin', 'Kronstadt'],
    'Krasnodar': ['Sochi', 'Krasnodar', 'Anapa', 'Gelendzhik'],
  },
  'Argentina': {
    'Buenos Aires': ['Buenos Aires', 'La Plata', 'San Isidro', 'Tigre'],
    'Patagonia': ['Bariloche', 'El Calafate', 'Ushuaia', 'Puerto Madryn'],
    'Mendoza': ['Mendoza', 'San Rafael', 'Lujan de Cuyo'],
  },
  'Colombia': {
    'Bogota': ['Bogota', 'Zipaquira', 'Chia', 'Soacha'],
    'Antioquia': ['Medellin', 'Guatape', 'Santa Fe', 'Jardin'],
    'Bolivar': ['Cartagena', 'Barranquilla', 'Santa Marta', 'San Andres'],
  },
};

export function getStates(country: string): string[] {
  return Object.keys(LOCATIONS[country] || {});
}

export function getCities(country: string, state: string): string[] {
  return LOCATIONS[country]?.[state] || [];
}

export default LOCATIONS;
