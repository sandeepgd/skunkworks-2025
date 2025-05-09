now = Math.floor(Date.now() / 1000); // Current time in seconds since epoch
db.users.insertOne({
    _id: 'U' + new ObjectId().toString(),
    name: 'Sandeep Dhoot',
    phoneNumber: '+18324217365',
    email: 'sandeep.dhoot@mongodb.com',
    createdAt: now,
    modifiedAt: now,
  });
db.users.insertOne({
    _id: 'U' + new ObjectId().toString(),
    name: 'Vignesh Ravindran',
    phoneNumber: '+18122721451',
    email: 'vignesh.ravindran@mongodb.com',
    createdAt: now,
    modifiedAt: now,
  });

sandeepDoc = db.users.findOne({name: 'Sandeep Dhoot'})
vigneshDoc = db.users.findOne({name: 'Vignesh Ravindran'})

now = Math.floor(Date.now() / 1000); // Current time in seconds since epoch
db.groups.insertMany([
    {
    _id: 'G' + new ObjectId().toString(),
    name: 'Family',
    createdBy: sandeepDoc._id,
    createdAt: now,
    },
    {
    _id: 'G' + new ObjectId().toString(),
    name: 'Friends',
    createdBy: sandeepDoc._id,
    createdAt: now,
    },
])
db.groups.insertMany([
    {
    _id: 'G' + new ObjectId().toString(),
    name: 'Family',
    createdBy: vigneshDoc._id,
    createdAt: now,
    },
    {
    _id: 'G' + new ObjectId().toString(),
    name: 'Friends',
    createdBy: vigneshDoc._id,
    createdAt: now,
    },
])

sandeepFamilyGroup = db.groups.findOne({name: 'Family', createdBy: sandeepDoc._id})
sandeepFriendsGroup = db.groups.findOne({name: 'Friends', createdBy: sandeepDoc._id})
db.users.updateOne(
  { _id: sandeepDoc._id },  // filter
  { $set: { groups: [ { name: "Family", id: sandeepFamilyGroup._id }, { name: "Friends", id: sandeepFriendsGroup._id } ] } }
)

vigneshFamilyGroup = db.groups.findOne({name: 'Family', createdBy: vigneshDoc._id})
vigneshFriendsGroup = db.groups.findOne({name: 'Friends', createdBy: vigneshDoc._id})
db.users.updateOne(
  { _id: vigneshDoc._id },  // filter
  { $set: { groups: [ { name: "Family", id: vigneshFamilyGroup._id }, { name: "Friends", id: vigneshFriendsGroup._id } ] } }
)

// Create index on chats collection.
db.chats.createIndex({ fromId: 1, toId: 1, sentAt: -1 })
