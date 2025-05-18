// Create necessary indexes
db.users.createIndex({ phoneNumber: 1 }, { unique: true })
db.groups.createIndex({ createdBy: 1 })
db.chats.createIndex({ userId: 1, sentAt: -1 })
db.highlights.createIndex({ userId: 1, sentAt: -1 })

// Define common group names
const GROUP_NAMES = ['Everyone', 'Family', 'Friends', 'Followers'];

// Define user data
const USERS = [
  {
    firstName: 'Sandeep',
    lastName: 'Dhoot',
    phoneNumber: '+18324217365',
  },
  {
    firstName: 'Vignesh',
    lastName: 'Ravindran',
    phoneNumber: '+18122721451',
  },
  {
    firstName: 'Sarah',
    lastName: 'Chen',
    phoneNumber: '+14155552671',
  },
  {
    firstName: 'Michael',
    lastName: 'Rodriguez',
    phoneNumber: '+16175551234',
  },
  {
    firstName: 'Emily',
    lastName: 'Thompson',
    phoneNumber: '+16175559876',
  },
  {
    firstName: 'David',
    lastName: 'Kim',
    phoneNumber: '+14155557890',
  }
];

// Helper function to create a user with their groups
function createUser(userData) {
  const now = Math.floor(Date.now() / 1000);
  const userDoc = {
    _id: 'U' + new ObjectId().toString(),
    ...userData,
    createdAt: now,
    modifiedAt: now
  };
  db.users.insertOne(userDoc);

  // Create groups for the user
  const groups = GROUP_NAMES.map(name => ({
    _id: 'G' + new ObjectId().toString(),
    name,
    createdBy: userDoc._id,
    createdAt: now
  }));
  
  db.groups.insertMany(groups);
  
  // Update user with their groups
  const groupData = groups.map(group => ({
    name: group.name,
    id: group._id
  }));
  
  db.users.updateOne(
    { _id: userDoc._id },
    { $set: { groups: groupData } }
  );
  
  return userDoc;
}

// Main execution
USERS.forEach(userData => createUser(userData));