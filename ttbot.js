// Created by Jen Jaimes on July 7, 2012

// Bug list:
// - need more profuse logs
// - mod chat says undefined
// - bop_mode=always: bot doesn't bop if ordered to /hop in first 30 secs of song
// - check if before the morning sun by senzar was actually snagged
// - listmods shows a bunch of undefined, also crashes if someone was just de-modded
// - afk doesn't work for symbols including J*$

// Wish list:
// - only list commands that are turned on for /commands, /help
// - snag returns "i already have" if already has
// - ban, banlist, unban
// - refresh
// - listmods
// - get list of upvotes at end of songs, use to find and kick afk djs
// - gettags
// - fix afk regex for usernames with symbols
// - addtag, tagsong, follow (tag)
// - command to remove a song from queue
// - check if artist of next song in queue was already played this round
// - games: guess a number, tic tac toe, hangman
// - autodrop on/off, num people on deck 2-5, announce before dropping
// - integrate with discogs api

// Default values of variables - some of these can be reconfigured in the cfgfile
var my = {};
my.auth = '';
my.userid = '';
my.roomid = '';
my.userids = [];					// userid
my.usernames = [];					// string
my.djs = [];						// userid
my.djplays = [];					// int
my.djafktimes = [];					// int
my.mods = [];						// userid
my.escortlist = [];					// userid
my.afklist = [];					// userid
my.isdj = false;					// boolean
my.isdrop = false;					// boolean
my.roomname = '';					// string
my.maxdjs = 0;						// int
my.maxplays = 0;					// int, 0 means unlimited
my.songid = '';						// string
my.escortafk = 0;					// int, 0 means unlimited
my.bop_responses = "Great play!";	// string
my.isbopping = false;				// boolean
my.afk_responses = "is AFK.";		// string
my.wake_response = "off";			// string
my.playlist = [];					// songid (not necessarily in order)
my.numsongsnags = 0;				// int
my.numsongfans = 0;					// int
my.numberguess = [];				// userid[]

// Default modes (on/off toggles for certain behaviors)
my.greeting_mode = true;			// boolean
my.queue_mode = "off";				// boolean
my.bop_mode = "off";				// string
my.hop_mode = "on";					// boolean
my.modchat_mode = "on";				// boolean
my.hello_mode = "on";				// boolean
my.roominfo_mode = "on";			// boolean
my.give_mode = "on";				// boolean
my.chill_mode = "on";				// boolean
my.space_mode = "on";				// boolean
my.escortme_mode = "on";			// boolean
my.afk_mode = "on";					// boolean
my.callme_mode = "on";				// boolean
my.fanratio_mode = "on";			// boolean
my.guessthenumber_mode = "on";		// boolean

// Read cfgfile
var cfgfile = process.argv[2];
var fs = require('fs');
try {
	var config = fs.readFileSync( cfgfile, 'utf8' );
	var lines = config.split( '\r\n' );
	for ( var i in lines ) {
		if ( lines[i] && !lines[i].match( /\#/ ) && lines[i].match( /=/ ) ) {
			var thisline = lines[i].replace( /\r?\n$/, '' );
			var tmp = thisline.split( '=' );
			console.log( tmp[0] + ' = ' + tmp[1] );
			var tmp0 = tmp[0];
			my[tmp0] = tmp[1];
		}
	}
} catch ( err ) {
	console.error( "Error reading config file:" );
	console.log( err );
}

// Start bot
var Bot = require( 'ttapi' );
var bot = new Bot( my.auth, my.userid, my.roomid );

console.log( 'Bot started' );

var date = new Date();

// *****************************************************************************************************************************************************
function chomp(raw_text)																		// utility for reading config file
{
	return raw_text.replace(/(\n|\r)+$/, '');
}

// *****************************************************************************************************************************************************
bot.on( 'roomChanged', function (data) {														// psybot enters room
	if ( my.wake_response != "off" ) {
		bot.speak( my.wake_response );
	}
	var mycurrenttime = date.getTime();
	
	for ( var i in data.room.metadata.djs ) {
		my.djs.push( data.room.metadata.djs[i] );
		my.djafktimes.push( mycurrenttime );
		my.djplays.push( 0 );
	}
	//bot.speak( 'DJs are ' + mydjs.join('\, ') );
	for ( var i in data.room.metadata.moderator_id ) {
		my.mods.push( data.room.metadata.moderator_id[i] );
	}
	//bot.speak( 'Mods are ' + mymods.join('\, ') );
	for ( var i in data.users ) {
		my.userids.push( data.users[i].userid );
		my.usernames.push( data.users[i].name );
	}
	my.userids.splice(0,1); 	// always null
	my.usernames.splice(0,1);	// always ttbot's id
	my.isdj = false;
	my.roomname = data.room.name;
	my.maxdjs = data.room.metadata.max_djs;
	//my.songid = data.room.metadata.current_song._id;  // TODO don't crash if there is no dj on stand when ttbot starts!!
	my.isbopping = false;

	bot.playlistAll( function(data) {
		for ( var i in data.list ) {
			my.playlist.push( data.list[i]._id );
		}
	});
});

// *****************************************************************************************************************************************************
bot.on( 'speak', function(data) {																// user says something in chat
	if ( data.userid == my.userid ) { return; }
	var mymodspeaks = false;																	// check if speaker is mod
	if ( my.mods.indexOf( data.userid ) != -1 ) {
		mymodspeaks = true;
	}
	var myownerspeaks = false;																	// check if speaker is owner
	if ( data.userid == my.ownerid ) {
		myownerspeaks = true;
	}
	var tmp = my.djs.indexOf( data.userid );													// update afk time if speaker is a dj
	if ( tmp != -1 ) {
		my.djafktimes[tmp] = date.getTime();
	}
	var name = my_getname ( data.userid );
	my_check_general_cmds( data.userid, name, data.text, true ) ||
	//my_check_game_cmds( data.userid, data.text, true ) ||
	( mymodspeaks && my_check_mod_cmds( data.userid, name, data.text, true ) ) ||
	( myownerspeaks && my_check_owner_cmds( name, data.text, true ) ) ||
	my_check_afk_mention( data.userid, name, data.text );
	
});

// *****************************************************************************************************************************************************
bot.on( 'pmmed', function(data) {																// ttbot receives a private message
	if ( data.senderid == my.userid ) { return; }
	var mymodspeaks = false;																	// check if speaker is mod
	if ( my.mods.indexOf( data.senderid ) != -1 ) {
		mymodspeaks = true;
	}
	var myownerspeaks = false;																	// check if speaker is owner
	if ( data.senderid == my.ownerid ) {
		myownerspeaks = true;
	}
	my_check_general_cmds( data.senderid, my_getname( data.senderid ), data.text, false ) ||
	my_check_game_cmds( data.senderid, data.text, false ) ||
	( mymodspeaks && my_check_mod_cmds( data.senderid, my_getname( data.senderid ), data.text, false ) ) ||
	( myownerspeaks && my_check_owner_cmds( my_getname( data.senderid ), data.text, false ) ) ||
	( mymodspeaks && ( my.modchat_mode == "on" ) && my_modchat( data.senderid, data.text ) );
});

// *****************************************************************************************************************************************************
bot.on( 'add_dj', function(data) {																// dj steps up
	my.djs.push( data.user[0].userid );
	my.djplays.push( 0 );
	my.djafktimes.push( date.getTime() );
	if ( data.user[0].userid == my.userid ) {													// psybot is escorted
		my.isdj = true;
	} else {
		setTimeout( function(data) {
			my_check_dj();
		}, 10000 );
	}
});

// *****************************************************************************************************************************************************
bot.on( 'rem_dj', function(data) {																// dj steps down or is escorted
	for ( var i in my.djs ) {
		if ( my.djs[i] == data.user[0].userid ) {
			my.djs.splice(i,1);
			my.djplays.splice(i,1);
			my.djafktimes.splice(i,1);
			break;
		}
	}
	for ( var i in my.escortlist ) {															// remove dj from escort list if necessary
		if ( my.escortlist[i] == data.user[0].userid ) {
			my.escortlist.splice(i,1);
			break;
		}
	}
	if ( data.user[0].userid == my.userid ) {													// psybot steps down or is escorted
		my.isdj = false;
	} else {
		setTimeout( function(data) {
			my_check_dj();
		}, 10000 );
	}
});

// *****************************************************************************************************************************************************
bot.on( 'new_moderator', function(data) {														// add new moderator
	my.mods.push( data.userid );
});

// *****************************************************************************************************************************************************
bot.on( 'rem_moderator', function(data) {														// remove moderator
	for ( var i in my.mods ) {
		if ( my.mods[i] == data.userid ) {
			my.mods.splice(i,1);
			break;
		}
	}
});

// *****************************************************************************************************************************************************
bot.on( 'newsong', function(data) {																// song starts
	bot.roomInfo( false, function(roomdata) {
		//var i = my.djs.indexOf( roomdata.room.metadata.current_dj );							// moved this to song ends
		//my.djplays[i] = my.djplays[i] + 1;
		//bot.speak( 'DJ plays: ' + my.djplays[i] );
		my.songid = roomdata.room.metadata.current_song._id;
	});
	if ( my.bop_mode == "always" ) {
		setTimeout( function(data) {
			my.isbopping || bot.bop();
		}, 30000 );
	}
});

// *****************************************************************************************************************************************************
bot.on( 'endsong', function(data) {																// song finishes
	if ( my.songstats_mode == "on" ) {
		var gotstats = false;
		var tmp = data.room.metadata.current_song.metadata.song + ":";
		if ( data.room.metadata.upvotes > 0 ) {
			tmp += " :+1:: " + data.room.metadata.upvotes;
			gotstats = true;
		}
		if ( data.room.metadata.downvotes > 0 ) {
			tmp += " :-1:: " + data.room.metadata.downvotes;
			gotstats = true;
		}
		if ( my.numsongsnags > 0 ) {
			tmp += " <3: " + my.numsongsnags;
			gotstats = true;
			my.numsongsnags = 0;
		}
		if ( my.numsongfans > 0 ) {
			tmp += " :star:: " + my.numsongfans;
			gotstats = true;
		}
		if ( gotstats ) {
			bot.speak( tmp );																	// announce song stats, if any
		}
	}
	if ( my.escortlist.indexOf( data.room.metadata.current_dj ) != -1 ) {
		bot.remDj( data.room.metadata.current_dj, function(data) {});							// execute "/escortme" command
		bot.speak( '@' + data.room.metadata.current_song.djname + ' had asked for an escort.' );
		for ( var i in my.escortlist ) {														// remove user from escort list
			if ( my.escortlist[i] == data.room.metadata.current_dj ) {
				my.escortlist.splice(i,1);
				break;
			}
		}
	} else if ( my.isdj && my.isdrop ) {														// execute "/drop" command
		bot.remDj( function(data) {});
		my.isdrop = false;
	} else {
		var i = my.djs.indexOf( data.room.metadata.current_dj );
		my.djplays[i] = my.djplays[i] + 1;
		var djnum = my.djs.indexOf( data.room.metadata.current_dj );							// kick for maxplays
		if ( my.maxplay_mode != "off" && my.djplays[djnum] >= my.maxplays ) {
			bot.speak( '@' + data.room.metadata.current_song.djname + ' has reached the play limit of ' + my.maxplays + ' songs.' );
			if ( my.maxplay_mode == "kick" ) {
				bot.remDj( data.room.metadata.current_dj, function(data) {});
			}
		}
	}
	my.numsnags = 0;
});

// *****************************************************************************************************************************************************
bot.on( 'registered', function(data) {															// user enters room
	if ( my.greeting_mode == "on" && data.user[0].userid != my.userid ) {
		setTimeout( function(data2) {
			bot.speak( 'Welcome to ' + my.roomname + ' \@' + data.user[0].name + '!' );
		}, 2000 );
	}
	my.userids.push( data.user[0].userid );														// add user to userids list
	my.usernames.push( data.user[0].name );														// add user to usernames list
});

// *****************************************************************************************************************************************************
bot.on( 'deregistered', function(data) {														// user leaves room
	if ( data.user[0].userid != my.userid ) {
		for ( var i in my.usernames ) {															// remove user from usernames list
			if ( my.usernames[i] == my_getname( data.user[0].userid ) ) {
				my.usernames.splice(i,1);
				break;
			}
		}
		for ( var i in my.afklist ) {															// remove user from afk list if necessary
			if ( my.afklist[i] == my_getname( data.user[0].userid ) ) {
				my.afklist.splice(i,1);
				break;
			}
		}
		for ( var i in my.userids ) {															// remove user from userids list
			if ( my.userids[i] == data.user[0].userid ) {
				my.userids.splice(i,1);
				break;
			}
		}
	}
});

// *****************************************************************************************************************************************************
bot.on( 'snagged', function(data) {																// user snags a song
	my.numsongsnags++;
	if ( data.userid == my.userid ) {															// psybot snags a song
		bot.speak( 'Yoink!' );
	}
});

// *****************************************************************************************************************************************************
bot.on( 'update_user', function(data) {															// user changes their profile (check for name change)
	var i = my.userids.indexOf( data.userid );
	my.usernames[i] = data.name;
});

// *****************************************************************************************************************************************************
function my_check_general_cmds( userid, name, text, isspeak ) {
	var mymatch = true;
	if ( text.match( /^\/hello/ ) && my.hello_mode == "on" ) {									// "/hello"
		isspeak
			? bot.speak( 'Greetings @' + name + ' !' )
			: bot.pm( 'Greetings ' + name + ' !', userid );
	} else if ( text.match( /^\/commands/ ) || text.match( /^\/help/ ) ) {					 	// "/commands" or "/help"
		var tmp = 'My commands are ';
		var cmds = [ 'hello', 'roominfo', 'give', 'chill', 'space', 'callme', 'escortme', 'afk', 'fanratio' ];
		var modcmds = [ 'hop', 'drop', 'skip', 'snag', 'bop', 'userid', 'username' ];
		for ( var i in cmds ) {
			tmp = tmp + '/' + cmds[i] + ', ';
		}
		tmp = tmp + '. Mods can also say ';
		for (var i in modcmds) {
			tmp = tmp + '/' + modcmds[i] + ', ';
		}
		isspeak
			? bot.speak( tmp )
			: bot.pm( tmp, userid );
	} else if ( text.match( /^\/roominfo/ ) && my.roominfo_mode == "on" ) {						// "/roominfo"
		bot.roomInfo( false, function(data) {
			isspeak
				? bot.speak( data.room.description )
				: bot.pm( data.room.description, userid );
		});
	//} else if ( text.match( /^\/listmods/ ) ) {												// "/listmods"
		//var tmp = "My masters are ";
		//for ( var i in my.mods ) {
		//	tmp += my_getname( my.mods[i] ) + ', ';
		//}
		//isspeak
		//	? bot.speak( tmp )
		//	: bot.pm ( tmp );
	} else if ( text.match( /^\/give/ ) && my.give_mode == "on" ) {								// "/give"
		var tmpitem = "nothing";
		tmpitem = text.slice(5);
		bot.speak( '\/me gives ' + tmpitem );
	} else if ( text.match( /^\/chill/ ) && my.chill_mode == "on" ) {							// "/chill"
		bot.speak( '@' + name + ' is chilled.' );
	} else if ( text.match( /^\/space/ ) && my.space_mode == "on" ) {							// "/space"
		bot.speak( '@' + name + ' is spaced.' );
	} else if ( text.match( /^\/callme/ ) && my.callme_mode == "on" ) {
		var tmpname = text.slice(8);
		var i = my.userids.indexOf( userid );
		my.usernames[i] = tmpname;
		isspeak
			? bot.speak( 'You got it ' + tmpname + '.' )
			: bot.pm( 'You got it ' + tmpname + '.', userid );
	} else if ( text.match( /^\/escortme/ ) && my.escortme_mode == "on" ) {						// "/escortme"
		if ( my.djs.indexOf( userid ) == -1 ) {
			isspeak
				? bot.speak( 'You\'re already on the floor @' + name + '!' )
				: bot.pm( 'You\'re already on the floor!', userid );
		} else if ( my.escortlist.indexOf( userid ) == -1 ) {
			isspeak
				? bot.speak( 'I got you covered @' + name + '.' )
				: bot.pm( 'I got you covered.', userid );
			my.escortlist.push( userid );
		} else {
			for ( var i in my.escortlist ) {
				if ( my.escortlist[i] == userid ) {
					my.escortlist.splice(i,1);
					break;
				}
			}
			isspeak
				? bot.speak( 'Ok you can stay up there @' + name + '.' )
				: bot.pm( 'Ok you can stay up there.', userid );
		}
	} else if ( text.match( /^\/afk/ ) && my.afk_mode == "on" ) {								// "/afk"
		if ( my.afklist.indexOf( userid ) == -1 ) {
			isspeak
				? bot.speak( 'Don\'t be gone too long @' + name + '!' )
				: bot.pm( 'Don\'t be gone too long!', userid );
			my.afklist.push( userid );
		} else {
			for ( var i in my.afklist ) {
				if ( my.afklist[i] == userid ) {
					my.afklist.splice(i,1);
					break;
				}
			}
			isspeak
				? bot.speak( 'Speak of the devil...' )
				: bot.pm( 'Speak of the devil...', userid );
		}
	} else if ( text.match( /^\/fanratio/ ) && my.fanratio_mode == "on" ) {						// "/fanratio"
		var tmpuser = text.slice(10);
		bot.getUserId ( tmpuser, function(data1) {
			var tmpid = data1.userid;
			bot.getProfile( tmpid, function(data2) {
				var tmp = tmpuser + " has " + data2.points + " points and " + data2.fans + " fans, for a ratio of " +  Math.round(data2.points/data2.fans) + ".";
				isspeak
					? bot.speak( tmp )
					: bot.pm( tmp, userid );
			});
		});
	} else {
		mymatch = false;
	}
	return mymatch;
}

// *****************************************************************************************************************************************************
function my_check_game_cmds( userid, text, isspeak ) {
	if ( text.match( /^\/guessthenumber/ ) && my.guessthenumber_mode == "on" ) {
		var r = ( Math.floor( Math.random() * 1000 ) + 1 );
		var tmp = { "id": userid, "low": 1, "high": 1000, "answer": r };
		my.numberguess[userid] = tmp;
		bot.pm( "I\'m thinking of a number between 1 and 1000. Say \"/guess #\" to tell me your guess.", userid );
	} else if ( text.match( /^\/guess/ ) && my.guessthenumber_mode == "on" ) {
		var guess = text.slice(6);
		if ( guess == my.numberguess[userid].answer ) {
			bot.pm( "You win! :beers:", userid );
			my.numberguess.splice( userid );
		} else if ( guess < my.numberguess[userid].answer ) {
			bot.pm( "Higher...", userid );
			my.numberguess[userid].low = guess;
		} else {
			bot.pm( "Lower...", userid );
			my.numberguess[userid].high = guess;
		}
	}
}

// *****************************************************************************************************************************************************
function my_check_mod_cmds( userid, name, text, isspeak ) {
	var mymatch = true;
	if ( text.match( /^\/hop/ ) ) {																// "/hop"
		if (!my.isdj && my.djs.length < my.maxdjs) {
			bot.addDj( function(data) {});
			my.isdj = true;
		}
	} else if ( text.match( /^\/drop/ ) ) {														// "/drop"
		if ( my.isdj ) {
			bot.roomInfo( false, function(roomdata) {
				if ( roomdata.room.metadata.current_dj == my.userid ) {
					bot.speak( 'I\'ll drop when my song is done.' );
					my.isdrop = true;
				} else {
					bot.remDj( function(data) {});
				}
			});
		}
	} else if ( text.match( /^\/skip/ ) ) {														// "/skip"
		bot.skip();
	} else if ( text.match( /^\/snag/ ) ) {														// "/snag" (and bop)
		bot.playlistAdd( my.songid, my.playlist.length - 1 );
		my.playlist.push( my.songid );
		bot.snag();
		bot.bop();
	} else if ( text.match( /^\/bop/ ) ) {														// "/bop"
		bot.roomInfo( false, function(roomdata) {
			switch ( my.bop_mode ) {
				case "strict" :
					var mynumbops = 0;
					var mynumlames = 0;
					for ( var i in roomdata.room.metadata.votelog ) {
						if ( roomdata.room.metadata.votelog[i][1] == "up" ) {
							mynumbops++;
						} else {
							mynumlames++;
						}
					}
					break;
					if ( userid == roomdata.room.metadata.current_dj ) {
						bot.speak( 'You can\'t request a bop for your own song silly!' );
					} else if ( mynumbops > mynumlames ) {
						bot.bop();
						var tmp = my.bop_responses.split( '\|' );
						var r = ( Math.floor( Math.random() * tmp.length ) ) % ( tmp.length + 1 );
						bot.speak( tmp[r] );
					} else {
						bot.speak( 'Sorry\, I only bop if the song is popular with the rest of the room.' );
					}
				case "loose" :
					bot.bop();
					var tmp = my.bop_responses.split( '\|' );
					var r = ( Math.floor( Math.random() * tmp.length ) + 1 );
					bot.speak( tmp[r] );
					break;
			}
		});
	} else if ( text.match( /^\/userid/ ) ) {													// "/userid <name>"
		var tmpname = text.slice(8);
		bot.getUserId( tmpname, function(data) {
			isspeak
				? bot.speak( tmpname + ' : ' + data.userid )
				: bot.pm( tmpname + ' : ' + data.userid, userid );
		});
	} else if ( text.match( /^\/username/ ) ) {													// "/username <id>"
		var id = text.slice(10);
		var tmpname = my_getname( id );
		isspeak
			? bot.speak( 'That user\'s name is ' + tmpname )
			: bot.pm( 'That user\'s name is ' + tmpname, userid );
	} else {
		mymatch = false;
	}
	return mymatch;
}

// *****************************************************************************************************************************************************
function my_check_owner_cmds( name, text, isspeak ) {
	var mymatch = true;
	if ( text.match( /^\/debug/ ) ) {															// "/debug <variable>"
		var tmp = text.slice(7);
		isspeak
			? bot.speak( tmp + ': ' + my[tmp] )
			: bot.pm( tmp + ': ' + my[tmp], my.ownerid );
	} else if ( text.match( /^\/say/ ) ) {														// "/say"
		var tmp = text.slice(5);
		bot.speak( tmp );
	} else if ( text.match( /^\/setvar/ ) ) {													// "/setvar"
		var tmp = text.slice(8).split( '=' );
		if ( tmp[0] != undefined && tmp[1] != undefined ) {
			my[tmp[0]] = tmp[1];
			bot.pm( tmp[0] + " has been set to " + tmp[1] + ".", my.ownerid );
		}
	} else {
		mymatch = false;
	}
	return mymatch;
}

// *****************************************************************************************************************************************************
function my_check_afk_mention( userid, name, text ) {											// AFK user is mentioned in chat
	//bot.pm( 'checking afk', '4e431fd74fe7d05d3800dc60' );
	for ( var i in my.afklist ) {
		var afkname = my_getname( my.afklist[i] );
		if ( text.indexOf( afkname ) != -1 ) {
			var tmp = my.afk_responses.split( '\|' );
			var r = Math.floor( ( Math.random() * tmp.length ) ) % tmp.length;
			bot.speak( '@' + afkname + ' ' + tmp[r] );
		}
	}
}

// *****************************************************************************************************************************************************
function my_modchat( senderid, text ) {															// internal: modchat
	for ( var i in my.mods ) {
		if ( my.mods[i] != my.userid && my.userids.indexOf( my.mods[i] ) != -1 && my.mods[i] != senderid ) {
			bot.pm( my_getname( senderid ) + ' said: ' + text, my.mods[i] );
			//console.log( 'my_modchat\ndata.userid ' + senderid + '\nindex ' + i );
		}
	}
}

// *****************************************************************************************************************************************************
function my_check_dj() {																		// internal: decide to hop up or down
	//if (myisdj && mydjs.length>3) {
	//	bot.remDj( function(data) {});
	//	myisdj = false;
	//}
	//else
	if ( my.hop_mode == "on" && !my.isdj && my.djs.length==1 ) {
		bot.addDj( function(data) {});
		my.isdj = true;
	}
}

// *****************************************************************************************************************************************************
function my_getname( id ) {																		// internal: get username from id
	var i = my.userids.indexOf( id );
	return my.usernames[i];
}

function my_guess_the_number( id, num ) {
	
}



