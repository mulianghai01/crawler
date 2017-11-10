/**
 * Created by chiji on 16/8/13.
 */
var rp = require('request-promise');
var cheerio = require('cheerio');
var config = require('./config');
var book = require('./data/dbmanage').book;
var review = require('./data/dbmanage').review
// var ysbook = require('./models').Bookys;
// var review = require('./models').Review;
// var mongoose = require('./models').mongoose;
var async = require('async');
var maxbookid = config.maxbookid;
var Promise = require('bluebird');
var fs = require('fs');

book.loadDatabase()
review.loadDatabase()

book.find = Promise.promisify(book.find)
book.insert = Promise.promisify(book.insert)
book.update = Promise.promisify(book.update)

//117415
// var ws = fs.createWriteStream('./errInfo.txt');
var bookslist = [];
var crawlInfo = function () {

    const ban = new Set([2268]);

    var urlist = [];
    for (var i = 0; i <= maxbookid; i++) {
        if (!ban.has(i))
            urlist.push(i);
    }
    console.log(urlist.length);
    async.mapLimit(urlist, 3, function (bookid, callback) {
        bookurl = config.urlpre + '/' + 'book/' + bookid;
        rp(bookurl).then(function (body) {

            if (body.length < 10000) {//id为空,没取到书
                callback(null, null);
                return;
            }
            try {
                var bookinfo = digBookInfo(body, bookid);
                // console.log(bookinfo);
                updateAndFilterBook(bookinfo,callback);
            } catch (err) {
                console.log(err);
            }
            finally {
                console.log(bookid);
            }



        }).catch(function (e) {
            var deal = function () {
                console.log('have an accident,restart!')
                dealBookInfo(bookid,callback);
            };
            setTimeout(deal,3000);

            console.log(e);
        })


    });
}

//再试一次,防止意外
var dealBookInfo = function (bookid,callback) {
    bookurl = config.urlpre + '/' + 'book/' + bookid;
    rp(bookurl).then(function (body) {

        if (body.length < 10000) {//id为空,没取到书
            callback(null, null);
            return;
        }
        try {
            var bookinfo = digBookInfo(body,bookid);
            updateandfilterBook(bookinfo,callback);
        } catch (err) {
            console.log(err);
        }
        finally {
            console.log(bookid);
        }



    }).catch(function (e) {
        console.log(e);
        var deal = function () {
            dealBookInfo(bookid,callback);
        };
        setTimeout(deal,3000);
    })
}

//提取书籍相关信息
var digBookInfo = function (body, bookid) {
    $ = cheerio.load(body);
    var bookinfo = {};
    bookinfo.bookid = bookid;
    bookinfo.tag = $("div.sokk-book-buttons a.tag").text();
    bookinfo.bookname = $('div.col-sm-7').children().eq(0).children().eq(0).text();
    bookinfo.author = $('ul.list-unstyled').children().eq(0).children().eq(0).text();
    bookinfo.rate = $('div.ys-book-averrate span').text().trim();
    var reg = /[0-9]{1,5}/g;
    bookinfo.commentorNum = $('div.ys-book-averrate small').text().trim().match(reg).join('');
    bookinfo.longIntro = $('div#bookinfo div.panel-body').text().trim();
    return bookinfo;
}


//更新数据库
var updateBookinfo =function (bookinfo,callback) {
    book.count({bookid: bookinfo.bookid}).then(function (data) {
        if (data < 1) {
            return book.create({
                bookid: bookinfo.bookid,
                rate: bookinfo.rate,
                commentorNum: bookinfo.commentorNum,
                bookname: bookinfo.bookname,
                author: bookinfo.author,
                longIntro: bookinfo.longIntro,
                tag: [bookinfo.author, bookinfo.bookname],
            }).then(function (data) {
                // console.log('321');
                // console.log(data);
                // callback(null, data);
            }).catch(function (e) {
                console.log(e);

            }).catch(function (e) {
                console.log(e);

            })
        }
        else {
            return book.update({bookid: bookinfo.bookid}, {$set: {commentorNum: bookinfo.commentorNum}})
                .then(function (data) {
                    // console.log('123');
                    console.log(data);
                });
        }
    }).then(callback);
}


var ws = fs.createWriteStream('./hotbooks171030.txt');
var savebook = function (bookinfo,dbinfo) {
    ws.write('《'+bookinfo.bookname + '》\t');
    ws.write(bookinfo.author+'\t');
    ws.write(bookinfo.rate+'\t');
    ws.write(bookinfo.commentorNum+'\t');
    ws.write(bookinfo.commentorNum-dbinfo.commentorNum+'\t');
    ws.write(parseInt(bookinfo.rate*(bookinfo.commentorNum-dbinfo.commentorNum))+'\n')
}

//更新数据库 将增量大于5的书籍输出
var updateAndFilterBook =function (bookinfo,callback) {
    book.find({bookid: bookinfo.bookid}).then(function (data) {
        console.log("data.length",data.length);
        if (data.length < 1) {
            return book.insert({
                bookid: bookinfo.bookid,
                rate: bookinfo.rate,
                commentorNum: bookinfo.commentorNum,
                bookname: bookinfo.bookname,
                author: bookinfo.author,
                longIntro: bookinfo.longIntro,
                tag: [bookinfo.author, bookinfo.bookname],
            }).then(function (data) {
                // console.log('321');
                // console.log(data);
                // callback(null, data);
            }).catch(function (e) {
                console.log(e);

            })
        }
        else {
            return book.update({bookid: bookinfo.bookid}, {$set: {commentorNum: bookinfo.commentorNum,rate:bookinfo.rate}})
                .then(function (data1) {
                    // console.log(data1);
                    // console.log(bookinfo.commentorNum);
                    // console.log(data[0].commentorNum);
                    if(bookinfo.commentorNum-data[0].commentorNum>=5){
                        console.log(bookinfo.bookname);
                        console.log(bookinfo.commentorNum-data[0].commentorNum);
                        savebook(bookinfo,data[0]);
                    }
                    // console.log('123');
                    // console.log(data1);
                });
        }
    }).then(callback);
}


//提取信息 并 更新数据库
var digBookInfo2 = function (body, bookid) {
    $ = cheerio.load(body);
    var bookinfo = {};
    bookinfo.bookid = bookid;
    bookinfo.tag = $("div.sokk-book-buttons a.tag").text();
    bookinfo.bookname = $('div.col-sm-7').children().eq(0).children().eq(0).text();
    bookinfo.author = $('ul.list-unstyled').children().eq(0).children().eq(0).text();
    bookinfo.rate = $('div.ys-book-averrate span').text().trim();
    var reg = /[0-9]{1,5}/g;
    bookinfo.commentorNum = $('div.ys-book-averrate small').text().trim().match(reg).join('');
    bookinfo.longIntro = $('div#bookinfo div.panel-body').text().trim();
    book.count({bookid: bookid}).then(function (data) {
        if (data < 1) {
            book.create({
                bookid: bookinfo.bookid,
                rate: bookinfo.rate,
                commentorNum: bookinfo.commentorNum,
                bookname: bookinfo.bookname,
                author: bookinfo.author,
                longIntro: bookinfo.longIntro,
                tag: [bookinfo.author, bookinfo.bookname],
            }).then(function (data) {
                console.log(data);
                // callback(null, data);
            }).catch(function (e) {
                console.log(e);

            }).catch(function (e) {
                console.log(e);

            })
        }
        else {
            book.update({bookid: bookinfo.bookid}, {$set: {commentorNum: bookinfo.commentorNum}})
                .then(function (data) {
                    console.log(data);
                });
        }
    })

}

var digReviewsInfo = function (body, bookid, callback) {
    $ = cheerio.load(body);

    var reviews = [];
    var reg = /[0-9]{1,15}/g;
    // console.log($('div.caption'));
    if ($('div.caption') != undefined) {
        $('div.caption').each(function () {
            var reviewInfo = {};
            reviewInfo.commentid = $(this).find('.media').attr('data-cid').trim();
            reviewInfo.userid = $(this).find('.pull-left').attr('href').match(reg).join('');
            // reviewInfo.commentid = item('div.media').attr('data-cid');
            reviewInfo.username = $(this).find('span.media-heading').text().trim();
            reviewInfo.usercomment = $(this).find('p.commentcontent').text().trim();
            reviewInfo.booklistid = $(this).find('small.pull-right a').attr('href');
            loveweight = $(this).find('div.btn-group').children().eq(0).children().eq(1).text().trim() ;
            // console.log(reviewInfo.loveweight);
            if (reviewInfo.booklistid != undefined) {
                reviewInfo.booklistid = reviewInfo.booklistid.slice(10);
            }
            else {
                reviewInfo.booklistid = null;
            }
            if (loveweight != ''){
                reviewInfo.loveweight = loveweight;
            }
            else {
                reviewInfo.loveweight = 0;
            }
            // console.log(reviewInfo.booklistid);
            reviews.push(reviewInfo);
        })
        var asyncs = require('async');
        maplimit = Promise.promisify(require('async').mapLimit);
        maplimit(reviews, 1, function (reviewInfo, cb) {
            review.count({commentid: mongoose.Types.ObjectId(reviewInfo.commentid)}).then(function (data) {
                // console.log(data);
                if (data < 1) {
                    review.create({
                        bookid: bookid,
                        bookname: reviewInfo.bookname,
                        userid: reviewInfo.userid,
                        username: reviewInfo.username,
                        usercomment: reviewInfo.usercomment,
                        commentid: mongoose.Types.ObjectId(reviewInfo.commentid),
                        booklistid: reviewInfo.booklistid,
                        loveweight:reviewInfo.loveweight,
                    }).then(function (data) {
                        console.log(data);
                        cb(null, null);
                    }).catch(function (e) {
                        console.log(e);
                    })
                }
                else {
                    cb(null, null);
                }
            })
        }).then(function () {
            if ($('div#next_comment_btn a').attr('onclick') != undefined) {
                // http://www.yousuu.com/ajax/nextcomment?bid=43326&nexttime=1468720815
                bid = bookid;
                nexttime = $('div#next_comment_btn a').attr('onclick').match(reg);
                nexttime = nexttime[1];
                rp('http://www.yousuu.com/ajax/nextcomment?bid=' + bid + '&nexttime=' + nexttime)
                    .then(function (data) {
                        data = JSON.parse(data);
                        // console.log(data.comment);
                        var deal = function () {
                            digReviewsInfo(data.comment, bookid, callback);
                        }
                        try {
                            setTimeout(deal, 100);
                        }
                        catch (err) {
                            callback(null, null);
                            return;
                        }

                    })
            }
            else {
                callback(null, null);
                return;
            }
        }).catch(function (e) {
            console.log(e);
        })
    }
    else {
        console.log('have funny!');
        callback(null, null);
        return;
    }

}


// book.find({bookid:5157}).then(function (data) {
//     console.log(data);
// })

crawlInfo();

