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
    name: 'Everyone',
    createdBy: sandeepDoc._id,
    createdAt: now,
    },
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
    {
    _id: 'G' + new ObjectId().toString(),
    name: 'Followers',
    createdBy: sandeepDoc._id,
    createdAt: now,
    },
])
db.groups.insertMany([
    {
    _id: 'G' + new ObjectId().toString(),
    name: 'Everyone',
    createdBy: vigneshDoc._id,
    createdAt: now,
    },
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
    {
    _id: 'G' + new ObjectId().toString(),
    name: 'Followers',
    createdBy: vigneshDoc._id,
    createdAt: now,
    },
])

sandeepEveryoneGroup = db.groups.findOne({name: 'Everyone', createdBy: sandeepDoc._id})
sandeepFamilyGroup = db.groups.findOne({name: 'Family', createdBy: sandeepDoc._id})
sandeepFriendsGroup = db.groups.findOne({name: 'Friends', createdBy: sandeepDoc._id})
sandeepFollowersGroup = db.groups.findOne({name: 'Followers', createdBy: sandeepDoc._id})
db.users.updateOne(
  { _id: sandeepDoc._id },  // filter
  { $set: { groups: [{ name: sandeepEveryoneGroup.name, id: sandeepEveryoneGroup._id }, { name: sandeepFamilyGroup.name, id: sandeepFamilyGroup._id }, { name: sandeepFriendsGroup.name, id: sandeepFriendsGroup._id }, { name: sandeepFollowersGroup.name, id: sandeepFollowersGroup._id }] } }
)

vigneshEveryoneGroup = db.groups.findOne({name: 'Everyone', createdBy: vigneshDoc._id})
vigneshFamilyGroup = db.groups.findOne({name: 'Family', createdBy: vigneshDoc._id})
vigneshFriendsGroup = db.groups.findOne({name: 'Friends', createdBy: vigneshDoc._id})
vigneshFollowersGroup = db.groups.findOne({name: 'Followers', createdBy: vigneshDoc._id})
db.users.updateOne(
  { _id: vigneshDoc._id },  // filter
  { $set: { groups: [ { name: vigneshEveryoneGroup.name, id: vigneshEveryoneGroup._id }, { name: vigneshFamilyGroup.name, id: vigneshFamilyGroup._id }, { name: vigneshFriendsGroup.name, id: vigneshFriendsGroup._id }, { name: vigneshFollowersGroup.name, id: vigneshFollowersGroup._id } ] } }
)

// Create index on chats collection.
db.chats.createIndex({ userId: 1, sentAt: -1 })
