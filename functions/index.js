const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();
const userCollection = db.collection("users");

// 요구사항
// 유저들이 가입을 할 때 이름에 한글이 있으면 안돼요 / CREATE
// 유저들이 가입을 할 때 이메일 형식이 다르면 안돼요 (@없으면 저장 금지) / CREATE
// 유저 이름으로 조회를 하고 싶어요. / GET
// 이메일 수정할 때도 @가 없으면 수정되지 않아요 / PUT
// 가입 후 1분이 안 지난 데이터는 삭제할 수 없어요 / DELETE

exports.createUser = onRequest((req, res) => {
    if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed");
    }

    const { name, email } = req.body;

    if (!name || !email) {
        return res.status(400).send({ error: "Missing name or email" });
    }

    if (/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(name)) {
        return res.status(400).send({ error: "Name should not be in Korean" });
    }

    if (!email.includes("@")) {
        return res.status(400).send({ error: "Not valid email expression" });
    }

    userCollection
        .add({
            name,
            email,
            createdAt: new Date(),
        })
        .then((newUserRef) => {
            res.status(201).send({
                id: newUserRef.id,
                message: "User created",
            });
        })
        .catch((error) => {
            console.error(error);
            res.status(500).send({ error: error.message });
        });

    console.log("admin.firestore keys: ", Object.keys(admin.firestore));
});

exports.getUser = onRequest((req, res) => {
    if (req.method !== "GET") {
        return res.status(405).send("Method Not Allowed");
    }

    const userName = req.query.name;
    if (!userName) {
        return res.status(400).send({ error: "Missing user name in query" });
    }

    userCollection
        .where("name", "==", userName)
        .limit(1)
        .get()
        .then((querySnapshot) => {
            if (querySnapshot.empty) {
                return res.status(404).send({ message: "User not found" });
            }

            const userDoc = querySnapshot.docs[0];
            res.status(200).send({ id: userDoc.id, ...userDoc.data() });
        })
        .catch((error) => {
            console.error(error);
            res.status(500).send({ error: error.message });
        });
});

exports.updateUser = onRequest((req, res) => {
    if (req.method !== "PUT") {
        return res.status(405).send("Method Not Allowed");
    }

    const userName = req.query.name;
    const updateFields = req.body;

    if (!userName || !updateFields) {
        return res
            .status(400)
            .send({ error: "Missing user name or update data" });
    }

    if (!updateFields.email.includes("@")) {
        return res.status(400).send({ error: "Not valid email expression" });
    }

    userCollection
        .where("name", "==", userName)
        .limit(1)
        .get()
        .then((querySnapshot) => {
            if (querySnapshot.empty) {
                return res.status(404).send({ message: "User not found" });
            }

            const userDoc = querySnapshot.docs[0];
            return userDoc.ref.update(updateFields);
        })
        .then(() => {
            res.status(200).send({ message: "User updated successfully" });
        })
        .catch((error) => {
            console.error(error);
            res.status(500).send({ error: error.message });
        });
});

exports.deleteUser = onRequest((req, res) => {
    if (req.method !== "DELETE") {
        return res.status(405).send("Method Not Allowed");
    }

    const userName = req.query.name;
    if (!userName) {
        return res.status(400).send({ error: "Missing user name in query" });
    }

    userCollection
        .where("name", "==", userName)
        .limit(1)
        .get()
        .then((querySnapshot) => {
            if (querySnapshot.empty) {
                return res.status(404).send({ message: "User not found" });
            }

            const userDoc = querySnapshot.docs[0];
            const userData = userDoc.data();
            const userCreatedAt = userData.createdAt;

            const nowAt = Date.now();

            if (nowAt - userCreatedAt.toMillis() < 60000) {
                return res.status(400).send({
                    message: "Unable to delete: data created recently",
                });
            } else {
                return userDoc.ref.delete().then(() => {
                    res.status(200).send({
                        message: "User deleted successfully",
                    });
                });
            }
        })
        .catch((error) => {
            console.error(error);
            res.status(500).send({ error: error.message });
        });
});
