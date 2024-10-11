const Canvas = require("canvas")
const axios = require('axios')
const { TwitterApi, EUploadMimeType } = require("twitter-api-v2")
const moment = require('moment')
require('moment-timezone')
const admin = require("firebase-admin")
require('dotenv').config()
console.log('Twitter bot is online')

// Connection to database
admin.initializeApp({
    credential: admin.credential.cert({
        type: process.env.type,
        project_id: process.env.project_id,
        private_key_id: process.env.private_key_id,
        private_key: process.env.private_key.replace(/\\n/g, '\n'),
        client_email: process.env.client_email,
        client_id: process.env.client_id,
        auth_uri: process.env.auth_uri,
        token_uri: process.env.token_uri,
        auth_provider_x509_cert_url: process.env.auth_provider_x509_cert_url,
        client_x509_cert_url: process.env.client_x509_cert_url,
        universe_domain: process.env.universe_domain
    }),
    databaseURL: "https://twitter-bot-c542e-default-rtdb.firebaseio.com/"
})

// Get account from database
var primary, secondary
admin.database().ref("Tokens").once('value', async function (data) {

    // Twitter app keys
    const appKey = "Agww4ZkejVv9TBBdhs4gISjq9"
    const appSecret = "EUU5uObgfuGXana8Ifdo8cyDphfEx6oZxRgZxqCNVOrf9cwMF1"

    //auth
    if (data.val().Primary.Status) {

        //inisilizing Twit
        primary = new TwitterApi({
            appKey: appKey,
            appSecret: appSecret,
            accessToken: await data.val().Primary.OAuthToken,
            accessSecret: await data.val().Primary.OAuthSecretToken,
        })
    }

    if (data.val().Secondary.Status) {

        //inisilizing Twit
        secondary = new TwitterApi({
            appKey: appKey,
            appSecret: appSecret,
            accessToken: await data.val().Secondary.OAuthToken,
            accessSecret: await data.val().Secondary.OAuthSecretToken,
        })
    }
})

// Convert Urls to base64
async function getBase64(url) {
    return axios.get(url, {
        responseType: 'arraybuffer'

    }).then(response => { return response.data })
}

const Blogposts = async () => {

    //result
    var blogs = []
    var response = []
    var number = 0

    //handle the blogs
    const BlogpostsEvents = async () => {

        //checking if the bot on or off
        admin.database().ref("Events").child("blogposts").once('value', async function (data) {
            const status = data.val().Active
            const lang = data.val().Lang
            const push = data.val().Push
            const Account = data.val().Account

            //if the event is set to be true [ON]
            if (status) {

                //request data
                axios.get(`https://www.fnbrmena.com/api/v1/fortnite/blogposts?lang=${lang}`)
                    .then(async res => {

                        //storing the first start up
                        if (number === 0) {

                            //storing
                            for (let i = 0; i < res.data.blogList.length; i++) {
                                blogs[i] = await res.data.blogList[i].slug
                            }

                            //stop from storing again
                            number++
                        }

                        //if push is enabled
                        if (push) blogs[0] = []

                        //storing the new blog to compare
                        for (let i = 0; i < res.data.blogList.length; i++) {
                            response[i] = await res.data.blogList[i].slug
                        }

                        //check if there is a new blog
                        if (JSON.stringify(response) !== JSON.stringify(blogs)) {

                            //new blog has been registerd lets find it
                            for (let i = 0; i < response.length; i++) {

                                //compare if its the index i includes or not
                                if (!blogs.includes(response[i])) {

                                    //filtering to get the new blog
                                    var newBlog = await res.data.blogList.filter(blog => {
                                        return blog.slug === response[i]
                                    })

                                    //seting up the description
                                    if (newBlog[0]._metaTags !== undefined) {

                                        //add description variable
                                        var description = `- ${newBlog[0]._metaTags}`
                                        description = description.replace(description.substring(2, description.indexOf("<meta name=\"description\" content=\"")), "")
                                        description = description.replace('<meta name="description" content="', "")
                                        description = description.substring(0, description.indexOf(">"))

                                    } else var description = `- ${newBlog[0].title}`

                                    //add the blog link
                                    description += ` #فورتنايت\n\n• الرابط: https://www.epicgames.com/fortnite${newBlog[0].urlPattern}`

                                    //set image
                                    var url = ``
                                    if (newBlog[0].shareImage !== undefined) url = newBlog[0].shareImage
                                    else if (newBlog[0].trendingImage !== undefined) url = newBlog[0].trendingImage
                                    else if (newBlog[0].image !== undefined) url = newBlog[0].image
                                    else url = "https://i.imgur.com/Dg7jrFV.jpeg"

                                    //
                                    //  tweet the blogpost
                                    //
                                    if (Account == "primary") {
                                        primary.v1.uploadMedia(await getBase64(url), { mimeType: EUploadMimeType.Png })
                                            .then(media => {
                                                primary.v2.tweet(description, {
                                                    media: {
                                                        media_ids: [media]
                                                    }
                                                }).catch(err => console.log(err))

                                            }).catch(err => console.log(err))

                                    } else if (Account == "secondary") {
                                        secondary.v1.uploadMedia(await getBase64(url), { mimeType: EUploadMimeType.Png })
                                            .then(media => {
                                                secondary.v2.tweet(description, {
                                                    media: {
                                                        media_ids: [media]
                                                    }
                                                }).catch(err => console.log(err))

                                            }).catch(err => console.log(err))
                                    }
                                }
                            }

                            //store the new data
                            for (let i = 0; i < res.data.blogList.length; i++) {
                                blogs[i] = await res.data.blogList[i].slug
                            }

                            //trun off push if enabled
                            await admin.database().ref("Events").child("blogposts").update({
                                Push: false
                            })

                        }

                    }).catch(err => {
                        if (err.response) console.log("The issue is in Blogposts Events ", err.response.data)
                        else console.log("The issue is in Blogposts Events ", err)
                    })
            }
        })
    }
    setInterval(BlogpostsEvents, 1 * 20000)
}

const Servers = async () => {

    //result
    var response = []
    var number = 0

    const ServersEvents = async () => {

        //checking if the bot on or off
        admin.database().ref("Events").child("servers").once('value', async function (data) {
            const status = data.val().Active
            const push = data.val().Push
            const Account = data.val().Account

            //if the event is set to be true [ON]
            if (status) {

                //request the token
                await axios.get('https://fnbrmena.com/api/v1/auth/get/Android')
                    .then(async token => {

                        //request data
                        await axios.get('http://lightswitch-public-service-prod.ol.epicgames.com/lightswitch/api/service/fortnite/status', {
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token.data.data.access_token}`
                            }
                        }).then(async res => {

                            if (number === 0) {

                                //store data
                                response = await res.data.status
                                number++
                            }

                            //push
                            if (push) response = []

                            //check data
                            if (res.data.status !== response) {

                                if (res.data.status.toLowerCase() === "up") {
                                    var serversStatus = '- فتحت السيرفرات أستمتعوا #فورتنايت ❤️'
                                    var url = 'https://i.ibb.co/rZ8g5rR/Q6TA03N.jpg'

                                    //
                                    //  tweet the blogpost
                                    //
                                    if (Account == "primary") {
                                        primary.v1.uploadMedia(await getBase64(url), { mimeType: EUploadMimeType.Png })
                                            .then(media => {
                                                primary.v2.tweet(serversStatus, {
                                                    media: {
                                                        media_ids: [media]
                                                    }
                                                })

                                            }).catch(err => console.log(err))
                                    } else if (Account == "secondary") {
                                        secondary.v1.uploadMedia(await getBase64(url), { mimeType: EUploadMimeType.Png })
                                            .then(media => {
                                                secondary.v2.tweet(serversStatus, {
                                                    media: {
                                                        media_ids: [media]
                                                    }
                                                })

                                            }).catch(err => console.log(err))
                                    }
                                }
                                else if (res.data.status.toLowerCase() === "down") {
                                    var serversStatus = '- تم اغلاق السيرفرات... #فورتنايت 🛠️'
                                    var url = 'https://i.ibb.co/52ft6BG/glFsVFf.jpg'

                                    //
                                    //  tweet the blogpost
                                    //
                                    if (Account == "primary") {
                                        primary.v1.uploadMedia(await getBase64(url), { mimeType: EUploadMimeType.Png })
                                            .then(media => {
                                                primary.v2.tweet(serversStatus, {
                                                    media: {
                                                        media_ids: [media]
                                                    }
                                                })

                                            }).catch(err => console.log(err))
                                    } else if (Account == "secondary") {
                                        secondary.v1.uploadMedia(await getBase64(url), { mimeType: EUploadMimeType.Png })
                                            .then(media => {
                                                secondary.v2.tweet(serversStatus, {
                                                    media: {
                                                        media_ids: [media]
                                                    }
                                                })

                                            }).catch(err => console.log(err))
                                    }
                                }

                                //trun off push if enabled
                                admin.database().ref("Events").child("servers").update({
                                    Push: false
                                })

                                //store data
                                response = await res.data.status

                            }
                        }).catch(err => {
                            console.log(err.response)
                            if (err.response) console.log("The issue is in Servers Events ", err.response.data)
                            else console.log("The issue is in Servers Events ", err)
                        })
                    })
            }
        })
    }
    setInterval(ServersEvents, 1 * 20000)
}

async function itemshopHandler() {

    // Global variables
    var uid = null
    var number = 0

    // Listen for itemshop change
    async function listener() {

        //checking if the bot on or off
        admin.database().ref("Events").child("itemshop").once('value', async function (data) {
            const status = data.val().Active
            const lang = data.val().Lang
            const push = data.val().Push
            const Account = data.val().Account

            // Check if event is active on database
            if (status) {

                // Request the itemshop data from an api
                await axios({
                    method: 'GET',
                    url: `https://fortniteapi.io/v2/shop?lang=${lang}`,
                    headers: {
                        Authorization: '6d960a51-50460ffb-00881638-e0d139e2'
                    }
                }).then(async res => {

                    // Constant variavble holds the shop data
                    const data = res.data.shop.filter(e => {
                        return e.mainType !== "sparks_song"
                    })

                    data.sort((a, b) => {
                        const idA = a.section.id;
                        const idB = b.section.id;
                        if (idA < idB) return -1;
                        if (idA > idB) return 1;
                        return 0;
                    });

                    // First run do not post
                    if (number === 0) {

                        // Store data
                        uid = res.data.lastUpdate.uid
                        number++
                    }

                    if (push) uid = null

                    // Compare data stored
                    if (uid !== res.data.lastUpdate.uid && res.data.fullShop) {

                        // Update global variables
                        uid = res.data.lastUpdate.uid

                        // Trun off push if enabled
                        admin.database().ref("Events").child("itemshop").update({
                            Push: false
                        })

                        // ...Start generating shop image

                        // Calculate image dimensions

                        // Canvas variables
                        var width = 100
                        var height = 512 + 100 + 275
                        var newline = 0
                        var x = 50
                        var y = 50

                        // Canvas length
                        var length = data.length

                        if (length <= 10) length = length / 2
                        else if (length >= 10 && length <= 20) length = length / 4
                        else if (length > 20 && length <= 50) length = length / 6
                        else if (length > 50 && length <= 100) length = length / 8
                        else if (length > 100 && length <= 150) length = length / 11
                        else if (length > 150 && length <= 200) length = length / 15
                        else length = length / 14

                        // Forcing to be int
                        if (length % 2 !== 0) {
                            length += 1;
                            length = length | 0;
                        }

                        // Creating width
                        width += (length * 512) + (length * 10) - 10

                        // Creating height
                        for (let i = 0; i < data.length; i++) {

                            if (newline === length) {
                                height += 512 + 10
                                newline = 0
                            }
                            newline++
                        }

                        // Registering fonts
                        Canvas.registerFont('./assets/font/Lalezar-Regular.ttf', { family: 'Arabic', weight: "400", style: "bold" });
                        Canvas.registerFont('./assets/font/BurbankBigRegularBlack.otf', { family: 'Burbank Big Condensed' })

                        // AplyText
                        const applyText = (canvas, text, width, font) => {
                            const ctx = canvas.getContext('2d')
                            let fontSize = font
                            do {
                                if (lang === "en") ctx.font = `${fontSize -= 1}px Burbank Big Condensed`
                                else if (lang === "ar") ctx.font = `${fontSize -= 1}px Arabic`
                            } while (ctx.measureText(text).width > width);
                            return ctx.font
                        }

                        // Create canvas
                        const canvas = Canvas.createCanvas(width, height)
                        const ctx = canvas.getContext('2d')
                        ctx.fillStyle = '#ffffff'

                        // Set background
                        const background = await Canvas.loadImage('./assets/Itemshop/background.png')
                        ctx.drawImage(background, 0, 0, canvas.width, canvas.height)

                        // Loop through every shop item
                        newline = 0
                        for (const item of data) {

                            const image = item.displayAssets[0].url ? item.displayAssets[0].url : "https://i.ibb.co/XCDwKHh/HVH5sqV.png"
                            const rarity = item.series ? item.series?.id : item.rarity?.id
                            newline++

                            // Searching...
                            if (rarity === "Legendary") {

                                // Creating image
                                const skinholder = await Canvas.loadImage('./assets/Rarities/newStyle/legendary.png')
                                ctx.drawImage(skinholder, x, y, 512, 512)
                                const skin = await Canvas.loadImage(image);
                                ctx.drawImage(skin, x, y, 512, 512)
                                const skinborder = await Canvas.loadImage('./assets/Rarities/newStyle/borderLegendary.png')
                                ctx.drawImage(skinborder, x, y, 512, 512)

                            } else if (rarity === "Epic") {

                                // Creating image
                                const skinholder = await Canvas.loadImage('./assets/Rarities/newStyle/epic.png')
                                ctx.drawImage(skinholder, x, y, 512, 512)
                                const skin = await Canvas.loadImage(image);
                                ctx.drawImage(skin, x, y, 512, 512)
                                const skinborder = await Canvas.loadImage('./assets/Rarities/newStyle/borderEpic.png')
                                ctx.drawImage(skinborder, x, y, 512, 512)

                            } else if (rarity === "Rare") {

                                // Creating image
                                const skinholder = await Canvas.loadImage('./assets/Rarities/newStyle/rare.png')
                                ctx.drawImage(skinholder, x, y, 512, 512)
                                const skin = await Canvas.loadImage(image);
                                ctx.drawImage(skin, x, y, 512, 512)
                                const skinborder = await Canvas.loadImage('./assets/Rarities/newStyle/borderRare.png')
                                ctx.drawImage(skinborder, x, y, 512, 512)

                            } else if (rarity === "Uncommon") {

                                // Creating image
                                const skinholder = await Canvas.loadImage('./assets/Rarities/newStyle/uncommon.png')
                                ctx.drawImage(skinholder, x, y, 512, 512)
                                const skin = await Canvas.loadImage(image);
                                ctx.drawImage(skin, x, y, 512, 512)
                                const skinborder = await Canvas.loadImage('./assets/Rarities/newStyle/borderUncommon.png')
                                ctx.drawImage(skinborder, x, y, 512, 512)

                            } else if (rarity === "Common") {

                                // Creating image
                                const skinholder = await Canvas.loadImage('./assets/Rarities/newStyle/common.png')
                                ctx.drawImage(skinholder, x, y, 512, 512)
                                const skin = await Canvas.loadImage(image);
                                ctx.drawImage(skin, x, y, 512, 512)
                                const skinborder = await Canvas.loadImage('./assets/Rarities/newStyle/borderCommon.png')
                                ctx.drawImage(skinborder, x, y, 512, 512)

                            } else if (rarity === "MarvelSeries") {

                                // Creating image
                                const skinholder = await Canvas.loadImage('./assets/Rarities/newStyle/marvel.png')
                                ctx.drawImage(skinholder, x, y, 512, 512)
                                const skin = await Canvas.loadImage(image);
                                ctx.drawImage(skin, x, y, 512, 512)
                                const skinborder = await Canvas.loadImage('./assets/Rarities/newStyle/borderMarvel.png')
                                ctx.drawImage(skinborder, x, y, 512, 512)

                            } else if (rarity === "DCUSeries") {

                                // Creating image
                                const skinholder = await Canvas.loadImage('./assets/Rarities/newStyle/dc.png')
                                ctx.drawImage(skinholder, x, y, 512, 512)
                                const skin = await Canvas.loadImage(image);
                                ctx.drawImage(skin, x, y, 512, 512)
                                const skinborder = await Canvas.loadImage('./assets/Rarities/newStyle/borderDc.png')
                                ctx.drawImage(skinborder, x, y, 512, 512)

                            } else if (rarity === "CUBESeries") {

                                // Creating image
                                const skinholder = await Canvas.loadImage('./assets/Rarities/newStyle/dark.png')
                                ctx.drawImage(skinholder, x, y, 512, 512)
                                const skin = await Canvas.loadImage(image);
                                ctx.drawImage(skin, x, y, 512, 512)
                                const skinborder = await Canvas.loadImage('./assets/Rarities/newStyle/borderDark.png')
                                ctx.drawImage(skinborder, x, y, 512, 512)

                            } else if (rarity === "CreatorCollabSeries") {

                                // Creating image
                                const skinholder = await Canvas.loadImage('./assets/Rarities/newStyle/icon.png')
                                ctx.drawImage(skinholder, x, y, 512, 512)
                                const skin = await Canvas.loadImage(image);
                                ctx.drawImage(skin, x, y, 512, 512)
                                const skinborder = await Canvas.loadImage('./assets/Rarities/newStyle/borderIcon.png')
                                ctx.drawImage(skinborder, x, y, 512, 512)

                            } else if (rarity === "ColumbusSeries") {

                                // Creating image
                                const skinholder = await Canvas.loadImage('./assets/Rarities/newStyle/starwars.png')
                                ctx.drawImage(skinholder, x, y, 512, 512)
                                const skin = await Canvas.loadImage(image);
                                ctx.drawImage(skin, x, y, 512, 512)
                                const skinborder = await Canvas.loadImage('./assets/Rarities/newStyle/borderStarwars.png')
                                ctx.drawImage(skinborder, x, y, 512, 512)

                            } else if (rarity === "ShadowSeries") {

                                // Creating image
                                const skinholder = await Canvas.loadImage('./assets/Rarities/newStyle/shadow.png')
                                ctx.drawImage(skinholder, x, y, 512, 512)
                                const skin = await Canvas.loadImage(image);
                                ctx.drawImage(skin, x, y, 512, 512)
                                const skinborder = await Canvas.loadImage('./assets/Rarities/newStyle/borderShadow.png')
                                ctx.drawImage(skinborder, x, y, 512, 512)

                            } else if (rarity === "SlurpSeries") {

                                // Creating image
                                const skinholder = await Canvas.loadImage('./assets/Rarities/newStyle/slurp.png')
                                ctx.drawImage(skinholder, x, y, 512, 512)
                                const skin = await Canvas.loadImage(image);
                                ctx.drawImage(skin, x, y, 512, 512)
                                const skinborder = await Canvas.loadImage('./assets/Rarities/newStyle/borderSlurp.png')
                                ctx.drawImage(skinborder, x, y, 512, 512)

                            } else if (rarity === "FrozenSeries") {

                                // Creating image
                                const skinholder = await Canvas.loadImage('./assets/Rarities/newStyle/frozen.png')
                                ctx.drawImage(skinholder, x, y, 512, 512)
                                const skin = await Canvas.loadImage(image);
                                ctx.drawImage(skin, x, y, 512, 512)
                                const skinborder = await Canvas.loadImage('./assets/Rarities/newStyle/borderFrozen.png')
                                ctx.drawImage(skinborder, x, y, 512, 512)

                            } else if (rarity === "LavaSeries") {

                                // Creating image
                                const skinholder = await Canvas.loadImage('./assets/Rarities/newStyle/lava.png')
                                ctx.drawImage(skinholder, x, y, 512, 512)
                                const skin = await Canvas.loadImage(image);
                                ctx.drawImage(skin, x, y, 512, 512)
                                const skinborder = await Canvas.loadImage('./assets/Rarities/newStyle/borderLava.png')
                                ctx.drawImage(skinborder, x, y, 512, 512)

                            } else if (rarity === "PlatformSeries") {

                                // Creating image
                                const skinholder = await Canvas.loadImage('./assets/Rarities/newStyle/gaming.png')
                                ctx.drawImage(skinholder, x, y, 512, 512)
                                const skin = await Canvas.loadImage(image);
                                ctx.drawImage(skin, x, y, 512, 512)
                                const skinborder = await Canvas.loadImage('./assets/Rarities/newStyle/borderGaming.png')
                                ctx.drawImage(skinborder, x, y, 512, 512)

                            } else {

                                // Creating image
                                const skinholder = await Canvas.loadImage('./assets/Rarities/newStyle/common.png')
                                ctx.drawImage(skinholder, x, y, 512, 512)
                                const skin = await Canvas.loadImage(image);
                                ctx.drawImage(skin, x, y, 512, 512)
                                const skinborder = await Canvas.loadImage('./assets/Rarities/newStyle/borderCommon.png')
                                ctx.drawImage(skinborder, x, y, 512, 512)

                            }

                            // Display item name
                            ctx.textAlign = 'center'
                            ctx.font = applyText(canvas, item.displayName, 450, 40)
                            ctx.fillText(item.displayName, 256 + x, (512 - 15) + y)

                            // Add the item price

                            // Write vbucks image
                            const vbucks = await Canvas.loadImage('https://media.fortniteapi.io/images/652b99f7863db4ba398c40c326ac15a9/transparent.png');
                            ctx.drawImage(vbucks, (5 + x), (y + 484), 25, 25);

                            ctx.textAlign = "left"
                            ctx.font = applyText(canvas, item.price.finalPrice, 450, 20)
                            ctx.fillText(item.price.finalPrice, 32 + x, (512 - 5) + y)

                            // Add last seen date

                            // Moment
                            var Now = moment();
                            const day = Now.diff(item.previousReleaseDate !== null ? moment(item.previousReleaseDate) : moment(item.firstReleaseDate), 'days');
                            ctx.textAlign = "right"
                            ctx.font = applyText(canvas, day, 450, 20)
                            ctx.fillText(lang === "en" ? `${day} Days` : `${day} يوم`, (512 - 2.5) + x, (512 - 4) + y)

                            // Utilizing tags
                            var yTags = 7 + y
                            var xTags = ((512 - 59) - 4) + x

                            // Loop through granted items
                            if (item.granted.length < 8) for (const granted of item.granted) {

                                if ((granted.id !== item.mainId) && granted.images.icon !== null) {

                                    // The granted icons
                                    const grantedItem = await Canvas.loadImage(granted.images.icon)
                                    ctx.drawImage(grantedItem, xTags, yTags, 50, 50)

                                    yTags += 55
                                }
                            }

                            // Add juno style top left
                            const filteredIndex = item.displayAssets.findIndex(item => item.primaryMode === 'Juno');
                            if (filteredIndex != -1) {

                                //draw the npc img
                                const juno = await Canvas.loadImage(item.displayAssets[filteredIndex].url);
                                ctx.drawImage(juno, x + 5, y + 5, 90, 90)
                            }

                            // Changing x and y
                            x = x + 10 + 512;
                            if (length === newline) {
                                y = y + 10 + 512;
                                x = 50;
                                newline = 0;
                            }
                        }

                        // Add code
                        ctx.fillStyle = '#ffffff'
                        ctx.textAlign = 'left';
                        const code = await Canvas.loadImage(lang === "en" ? './assets/Itemshop/code.png' : './assets/Itemshop/codeAR.png')
                        ctx.drawImage(code, canvas.width - 1050, (height - 250), 1000, 200)
                        ctx.font = `125px Burbank Big Condensed`

                        // Add the timer
                        await axios({
                            method: "GET",
                            url: "https://api.nitestats.com/v1/epic/modes-smart"
                        }).then(async cal => {
                            moment.locale("en")

                            // Get the states array
                            const currentDate = moment();
                            let activeDailyStoreEnd = moment(cal.data.channels['client-events'].states[0].state.dailyStoreEnd);
                            if (currentDate.isAfter(activeDailyStoreEnd)) {

                                activeDailyStoreEnd = moment(cal.data.channels['client-events'].states[1].state.dailyStoreEnd);
                            }

                            const date = moment.duration(moment(activeDailyStoreEnd).diff(moment()))
                            const hours = date.hours()
                            const minutes = date.minutes()
                            const seconds = date.seconds()

                            // Display the timer
                            const timer = await Canvas.loadImage('./assets/Itemshop/timer.png')
                            ctx.drawImage(timer, 42, (height - 642), 1000, 1000)
                            ctx.textAlign = 'left';
                            ctx.font = `150px Burbank Big Condensed`
                            ctx.fillText(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`, 300, (height - 95))
                        })

                        moment.locale(lang)
                        ctx.textAlign = 'center';
                        ctx.font = `120px ${lang === "en" ? "Burbank Big Condensed" : "Arabic"}`
                        ctx.fillText(moment(res.data.lastUpdate.date).format(`dddd, Do MMMM YYYY`), (width / 2), (height - 55))

                        //
                        //  Tweet the itemshop image
                        //

                        let buffer;
                        let mimeType = EUploadMimeType.Jpeg; // Default mimeType for JPEG

                        if (canvas.toBuffer('image/png').length < 5242880) {
                            buffer = canvas.toBuffer('image/png');
                            mimeType = EUploadMimeType.Png; // Set mimeType to PNG for smaller PNG files
                        } else {
                            let q = 0.9
                            buffer = canvas.toBuffer('image/jpeg')
                            while (buffer.length > 5242880 && q > 0) {
                                buffer = canvas.toBuffer('image/jpeg', { quality: q })
                                q -= 0.1
                            }
                        }

                        // Rest of your code...
                        var tweetmsg = `- شوب اليوم يحتوي على ${data.length} عنصر #فورت_نايت 🛒\n\n${moment(res.data.lastUpdate.date).format(`dddd, Do MMMM YYYY`)} 📆\nاستعمل كود AV2 في المتجر عشان تدعمني 🩵`;

                        if (Account == "primary") {
                            primary.v1.uploadMedia(buffer, { mimeType: mimeType })
                                .then(media => {
                                    primary.v2.tweet(tweetmsg, {
                                        media: {
                                            media_ids: [media]
                                        }
                                    })
                                }).catch(err => console.log(err))
                        } else if (Account == "secondary") {
                            secondary.v1.uploadMedia(buffer, { mimeType: mimeType })
                                .then(media => {
                                    secondary.v2.tweet(tweetmsg, {
                                        media: {
                                            media_ids: [media]
                                        }
                                    })
                                }).catch(err => console.log(err))
                        }
                    }
                })
            }
        })
    }

    // Check for changes
    setInterval(listener, 1.5 * 40000)
}

// Activate events
Blogposts()
itemshopHandler()
Servers()