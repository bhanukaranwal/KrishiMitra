import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding KrishiMitra database...');

  // Create admin user
  const hashedPassword = await bcrypt.hash('Admin123!', 12);
  
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@krishimitra.com',
      phone: '+919876543210',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
      phoneVerified: true,
      profile: {
        create: {
          country: 'IN',
          state: 'Karnataka',
          city: 'Bangalore',
          education: 'POST_GRADUATION',
          technicalSkills: ['agriculture', 'technology', 'management'],
          languages: ['en', 'hi', 'kn'],
        }
      }
    }
  });

  // Create sample farmers
  const farmers = [
    {
      email: 'ramesh.farmer@gmail.com',
      phone: '+919876543211',
      firstName: 'Ramesh',
      lastName: 'Kumar',
      state: 'Punjab',
      city: 'Ludhiana',
      crops: ['wheat', 'rice', 'sugarcane'],
      farmingMethod: 'CONVENTIONAL'
    },
    {
      email: 'priya.devi@gmail.com',
      phone: '+919876543212',
      firstName: 'Priya',
      lastName: 'Devi',
      state: 'Tamil Nadu',
      city: 'Coimbatore',
      crops: ['rice', 'cotton', 'turmeric'],
      farmingMethod: 'ORGANIC'
    },
    {
      email: 'suresh.patel@gmail.com',
      phone: '+919876543213',
      firstName: 'Suresh',
      lastName: 'Patel',
      state: 'Gujarat',
      city: 'Rajkot',
      crops: ['cotton', 'groundnut', 'castor'],
      farmingMethod: 'INTEGRATED'
    }
  ];

  for (const farmerData of farmers) {
    const farmer = await prisma.user.create({
      data: {
        email: farmerData.email,
        phone: farmerData.phone,
        password: await bcrypt.hash('Farmer123!', 12),
        firstName: farmerData.firstName,
        lastName: farmerData.lastName,
        role: 'FARMER',
        status: 'ACTIVE',
        emailVerified: true,
        phoneVerified: true,
        profile: {
          create: {
            country: 'IN',
            state: farmerData.state,
            city: farmerData.city,
            farmingExperience: Math.floor(Math.random() * 20) + 5,
            landOwnership: 'OWNED',
            primaryCrops: farmerData.crops,
            farmingMethods: [farmerData.farmingMethod],
            annualIncome: Math.floor(Math.random() * 500000) + 100000,
            familySize: Math.floor(Math.random() * 6) + 2,
            education: 'SECONDARY',
            languages: ['hi', 'en'],
          }
        }
      }
    });

    // Create farm for each farmer
    await prisma.farm.create({
      data: {
        name: `${farmerData.firstName}'s Farm`,
        ownerId: farmer.id,
        address: `${farmerData.city}, ${farmerData.state}, India`,
        coordinates: {
          lat: 20 + Math.random() * 15,
          lng: 70 + Math.random() * 20
        },
        area: Math.random() * 5 + 0.5,
        soilType: 'LOAM',
        irrigationType: ['DRIP', 'SPRINKLER'],
        status: 'ACTIVE',
        verificationStatus: 'VERIFIED'
      }
    });
  }

  // Create sample IoT devices
  const deviceTypes = ['WEATHER_STATION', 'SOIL_SENSOR', 'IRRIGATION_CONTROLLER'];
  const farms = await prisma.farm.findMany();

  for (let i = 0; i < 20; i++) {
    const farm = farms[Math.floor(Math.random() * farms.length)];
    
    await prisma.ioTDevice.create({
      data: {
        deviceId: `DEVICE_${String(i + 1).padStart(3, '0')}`,
        name: `${deviceTypes[i % deviceTypes.length]} ${i + 1}`,
        type: deviceTypes[i % deviceTypes.length],
        model: 'KM-2024-V1',
        manufacturer: 'KrishiMitra IoT',
        farmId: farm.id,
        location: {
          lat: 20 + Math.random() * 15,
          lng: 70 + Math.random() * 20
        },
        configuration: {
          samplingInterval: 300,
          transmissionInterval: 900,
          sensors: ['temperature', 'humidity', 'soil_moisture']
        },
        status: 'ACTIVE',
        batteryLevel: Math.floor(Math.random() * 100),
        signalStrength: Math.floor(Math.random() * 100),
        protocol: 'MQTT'
      }
    });
  }

  // Generate sample sensor data
  const devices = await prisma.ioTDevice.findMany();
  const now = new Date();
  
  for (const device of devices.slice(0, 5)) { // Only for first 5 devices
    for (let days = 7; days >= 0; days--) {
      const timestamp = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      
      await prisma.sensorData.create({
        data: {
          deviceId: device.id,
          temperature: 20 + Math.random() * 15,
          humidity: 40 + Math.random() * 40,
          soilMoisture: 30 + Math.random() * 40,
          soilTemperature: 18 + Math.random() * 10,
          soilPH: 6 + Math.random() * 2,
          soilEC: 500 + Math.random() * 1000,
          windSpeed: Math.random() * 10,
          windDirection: Math.floor(Math.random() * 360),
          rainfall: Math.random() * 50,
          solarRadiation: 200 + Math.random() * 800,
          uvIndex: Math.random() * 10,
          pressure: 950 + Math.random() * 100,
          timestamp: timestamp,
          quality: 'GOOD',
          validated: true
        }
      });
    }
  }

  console.log('✅ Database seeded successfully!');
  console.log(`📊 Created: ${farmers.length} farmers, ${farms.length} farms, ${devices.length} IoT devices`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
