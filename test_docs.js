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
    name: 'Sandeep Dhoot',
    phoneNumber: '+18324217365',
    email: 'sandeep.dhoot@mongodb.com'
  },
  {
    name: 'Vignesh Ravindran',
    phoneNumber: '+18122721451',
    email: 'vignesh.ravindran@mongodb.com'
  },
  {
    name: 'Sarah Chen',
    phoneNumber: '+14155552671',
    email: 'sarah.chen@mongodb.com'
  },
  {
    name: 'Michael Rodriguez',
    phoneNumber: '+16175551234',
    email: 'michael.rodriguez@mongodb.com'
  },
  {
    name: 'Emily Thompson',
    phoneNumber: '+16175559876',
    email: 'emily.thompson@mongodb.com'
  },
  {
    name: 'David Kim',
    phoneNumber: '+14155557890',
    email: 'david.kim@mongodb.com'
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