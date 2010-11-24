function ScheduleAssistant() {
	/* this is the creator function for your scene assistant object. It will be passed all the 
	   additional parameters (after the scene name) that were passed to pushScene. The reference
	   to the scene controller (this.controller) has not be established yet, so any initialization
	   that needs the scene controller should be done in the setup function below. */
}

ScheduleAssistant.prototype.setup = function() {
	/* this function is for setup tasks that have to happen when the scene is first created */
		
	/* use Mojo.View.render to render view templates and add them to the scene, if needed. */
	
	/* setup widgets here */
	this.controller.stageController.setWindowOrientation('free');
	
	/* add event handlers to listen to events from widgets */
	
	//console.log("***** INITIALIZING SCHEDULE...");
	
	// this setting is very important: it stores the name of the conference!
	this.conference = 'pddnyc';
	this.conferenceYear = '2010';
	
	this.controller.setupWidget(
	    Mojo.Menu.appMenu, 
	    { omitDefaultItems: true }, 
	    {
		    visible: true,
		    items: [
			    Mojo.Menu.editItem,
			    //{ label: $L('Campus map'), command: 'cmdMap' },
        		{ label: $L('Help / About'), command: 'cmdHelp' }
		    ]
	    }
	);
	
    this.controller.setupWidget(
        Mojo.Menu.commandMenu, 
        {
            //spacerHeight: 0,
            //menuClass: 'no-fade'
        }, 
	    this.viewFilterMenuModel = {
	        visible: true,
	        items: [ 
	            { label: $L('Refresh'), icon: 'refresh', command: 'cmdRefresh' },
	            //{ label: $L('Hide expired events'), command:'cmdShowUpcoming' } // HIDE EXPIRED CURRENTLY DISABLED

	            {label: $L('View options'), toggleCmd: 'cmdShowAll', items: [
	                { label: $L('Show all'), icon: 'favallbtn', command: 'cmdShowAll' },
					{ label: $L('Show only favorites'), icon: 'favbtn', command: 'cmdShowFavs' }
				]}
	        ] 
        }
    );
    
    // overall schedule items
    this.scheduleItems = [];
    
    // schedule items currently visible
    this.scheduleItemsShown = [];
    
    this.dbInitializedState = false;
    
    that = this; // this allows accessing the assistent object from other scopes. Ugly!
    
    // open database storage
	this.depot = new Mojo.Depot(
	    {
		    name: that.conference + "Schedule", // Name used for the HTML5 database name. (required)
		    //replace: false // open an existing depot
	            replace: false
	    }, 
	    that.dbInitialized,
	    that.dbError
    );
    
    // Set up a few models so we can test setting the widget model:
	this.listModel = {
	    listTitle: this.conference + ' ' + this.conferenceYear + ' ' + $L('Schedule'), 
	    items: this.scheduleItemsShown // not necessary for lazy list
    };
	
	// Set up the attributes & model for the List widget:
	this.controller.setupWidget(
	    'schedule_list', 
        { 
            itemTemplate: 'schedule/list/listitem', 
            listTemplate: 'schedule/list/listcontainer',
            dividerTemplate: 'schedule/list/divider', 
            dividerFunction: this.dividerFunc.bind(this),
            filterFunction: this.filterFunction.bind(this),
            //itemsCallback:this.itemsCallback.bind(this),
            renderLimit: 1000, // 200 for lazy one
            //lookahead: 15,
            delay: 1000 // 1 second delay before filter string is used
        },
        this.listModel
    );
	
	this.controller.listen('schedule_list', Mojo.Event.listTap, this.listTapped.bindAsEventListener(this));
	
    this.spinnerModel = { spinning: true }
    
    this.controller.setupWidget("schedule_spinner", {spinnerSize: 'large'}, this.spinnerModel);
    
    // setup favorite checkbox widgets in item details drawer
    this.controller.setupWidget('listCheckBox', {property: 'favorite', modelProperty: 'favorite'});
    
    // bind propertyChange event of list model to handler (used for favorites)
    this.controller.listen('schedule_list', Mojo.Event.propertyChange, this.listPropertyChanged.bindAsEventListener(this));
}

ScheduleAssistant.prototype.dbInitialized = function( result ) {
	//console.log("***** DB INITIALIZED!");
	
	that.depot.simpleGet(
	    'schedule', 
	    that.setEventItems, 
	    that.dbError
    );
}

ScheduleAssistant.prototype.setEventItems = function( items ) {
	//console.log("***** START SETTING ITEMS... ");

    if( items == null ) {
        that.controller.showAlertDialog({
            onChoose: function(value) {
                if( value == 'refresh' ) {
                    that.refreshSchedule();
                } else {
                    that.spinnerModel.spinning = false;
                    that.controller.modelChanged(that.spinnerModel);
                }
            },
            title: $L("Welcome!"),
            message: $L("There is currently no schedule stored on your phone. Do you want to download it now?"),
            choices:[
                 {label:$L('Yes'), value:"refresh", type:'affirmative'},  
                 {label:$L("No"), value:"well", type:'negative'}
            ]
        });
        return;
    }

    if( items.items ) {
        // this seems to be a db response, so extract items property
        var items = items.items;
    }
    
    //console.log("***** THERE ARE "+items.length+" items!");
    
    if( items.length == 0 ) {
        Mojo.Controller.errorDialog($L('No events found. If you tried to refresh events, the request failed - please refresh again.'));
        that.spinnerModel.spinning = false;
        that.controller.modelChanged(that.spinnerModel);
        return;
    }
    
    items.sort( that.orderSchedule );
        
	that.scheduleItems = items;
	that.scheduleItemsShown = items;
	
	this.dbInitializedState = true;
	
    //console.log("***** SETTING ITEMS: " + items.length);
    
    that.listModel.items = that.scheduleItemsShown;
    that.controller.modelChanged(that.listModel);
    
    that.refreshFavStars();

    that.spinnerModel.spinning = false;
    that.controller.modelChanged(that.spinnerModel);
}

ScheduleAssistant.prototype.refreshFavStars = function() {
	for( var i=0; i<that.scheduleItemsShown.length; i++ ) {
        if( that.scheduleItemsShown[i].favorite == true ) {
            jQuery('#star-'+that.scheduleItemsShown[i].id).addClass('starActive');
        } else {
            jQuery('#star-'+that.scheduleItemsShown[i].id).removeClass('starActive');
        }
    }
}

ScheduleAssistant.prototype.dbError = function( transaction, result ) {
	Mojo.Controller.errorDialog($L('A database error occured!'));
	//console.log("***** DB ERROR:");
}

ScheduleAssistant.prototype.itemsCallback = function(listWidget, offset, count) {	
        
        // TODO: Lazy feature doesn't work atm (never gets called?!).
        
		if( that.dbInitializedState == false ) {
		    that.itemsCallback.delay(1, listWidget, offset, count);
		}
		
		console.log("offset = " + offset);
		console.log("count = " + count);
		console.log("list length = " + that.scheduleItemsShown.length);

		that.updateListWithNewItems(listWidget, offset, that.scheduleItemsShown.slice(offset, offset+count));
		
		// It's okay to call this every time, but only the first call will have any affect.
		listWidget.mojo.setLength(that.scheduleItemsShown.length);
}
	
ScheduleAssistant.prototype.updateListWithNewItems = function(listWidget, offset, items) {
    listWidget.mojo.noticeUpdatedItems(offset, items);
}

ScheduleAssistant.prototype.dividerFunc = function(itemModel) {
    // We're using the localized item's date as the divider label.
    
    var dateDetails = this.parseDate( itemModel.dtstart );
    var dateObj = new Date( 
        dateDetails.year,
        dateDetails.month-1,
        dateDetails.day,
        dateDetails.hour,
        dateDetails.minute,
        00
    );
    
	return Mojo.Format.formatDate( dateObj, {date: 'long'} );
}

ScheduleAssistant.prototype.filterFunction = function(filterString, listWidget, offset, count) {
    var subset = [];
	var totalSubsetSize = 0;
	
	//loop through the original data set & get the subset of items that have the filterstring 
	var i = 0;
	while( i <  this.scheduleItemsShown.length ) {
		
        if( this.scheduleItemsShown[i].time.toLowerCase().include(filterString.toLowerCase())
         || this.scheduleItemsShown[i].location.toLowerCase().include(filterString.toLowerCase())
         || this.scheduleItemsShown[i].title.toLowerCase().include(filterString.toLowerCase())
         || this.scheduleItemsShown[i].attendee.toLowerCase().include(filterString.toLowerCase())
        ) {
			if( subset.length < count && totalSubsetSize >= offset) {
				subset.push( this.scheduleItemsShown[i] );
			}
			totalSubsetSize++;
		}
		i++;
	}
	
	subset.sort( this.orderSchedule );
	
	//update the items in the list with the subset
	listWidget.mojo.noticeUpdatedItems( offset, subset );
	
	this.refreshFavStars();
	
	//set the list's lenght & count if we're not repeating the same filter string from an earlier pass
	if( this.filter !== filterString ) {
		listWidget.mojo.setLength( totalSubsetSize );
		listWidget.mojo.setCount( totalSubsetSize );
	}
	this.filter = filterString;
};

ScheduleAssistant.prototype.orderSchedule = function( a, b ) {
    if( a.dtstart < b.dtstart ) {
        return -1;
    }
    if( a.dtstart == b.dtstart ) {
        if( a.title < b.title ) {
            return -1;
        }
        if( a.title == b.title ) {
            return 0;
        }
        if( a.title > b.title ) {
            return 1;
        }
    }
    if( a.dtstart > b.dtstart ) {
        return 1;
    }
}

ScheduleAssistant.prototype.activate = function(event) {
	/* put in event handlers here that should only be in effect when this scene is active. For
	   example, key handlers that are observing the document */
}


ScheduleAssistant.prototype.deactivate = function(event) {
	/* remove any event handlers you added in activate and do any other cleanup that should happen before
	   this scene is popped or another scene is pushed on top */
}

ScheduleAssistant.prototype.cleanup = function(event) {
	/* this function should do any cleanup needed before the scene is destroyed as 
	   a result of being popped off the scene stack */
}

ScheduleAssistant.prototype.handleCommand = function(event) {
	this.controller = Mojo.Controller.stageController.activeScene();
	
	if( event.type == Mojo.Event.command ) {
		switch( event.command )
		{
			case 'cmdRefresh':
				this.refreshSchedule();
			    break;
			case 'cmdShowAll':
				this.showFiltered('all');
			    break;
			case 'cmdShowFavs':
				this.showFiltered('favs');
			    break;
			case 'cmdShowUpcoming':
				this.showFiltered('upcoming');
			    break;
			case 'cmdHelp':
				Mojo.Controller.stageController.pushScene("help");
			    break;
			case 'cmdMap':
				Mojo.Controller.stageController.pushScene("map");
			    break;
		}
	}
}

ScheduleAssistant.prototype.listTapped = function(event){
	try {
		var drawer = "eventDrawer-" + event.item.id;
		this.controller.get(drawer).mojo.toggleState();
	} catch (e) {}
}

ScheduleAssistant.prototype.refreshSchedule = function() {
    //console.log("***** STARTING REFRESH SCHEDULE...");

    this.spinnerModel.spinning = true;
    this.controller.modelChanged(this.spinnerModel);
	
    this.controller.serviceRequest('palm://com.palm.connectionmanager', {
	    method: 'getstatus',
	    parameters: {subscribe:false},
	    onSuccess: function(response) {
	        if( response.isInternetConnectionAvailable !== true ) {
	            Mojo.Controller.errorDialog($L('Can\'t connect to server. Please make sure your internet connection is available.'));
	        }
	    },
	    onFailure: function(response) {
	        Mojo.Controller.errorDialog($L('Failed to get connection status. Please try again.'));
	    }
	});

    //console.log("***** STARTING AJAX REQUEST...");
    
    var dataURL = "http://www.inorbit.ch/upload/pddnycschedule.json"; // Palm Developer Day NYC 2010

    var request = new Ajax.Request(dataURL, {

        method: 'get',
        evalJSON: 'false',
        onSuccess: function(transport){
            that.incubateSetAndSaveResponse( transport );
        },
        onFailure: function(){  
            Mojo.Controller.errorDialog($L('Can\'t connect to server. Please make sure your internet connection is available.'));
        }

    });

}

ScheduleAssistant.prototype.incubateSetAndSaveResponse = function( transport ) {
    //console.log("***** STARTING INCUBATING...");

    eventCounter = 0;
    
    // temporarily save favorites' uid here to reassign state later
    that.tempFavorites = [];  // TODO: Store favs in depot?
    for( var i=0; i<that.scheduleItems.length; i++ ) {
        if( that.scheduleItems[i].favorite == true ) {
            that.tempFavorites.push(that.scheduleItems[i].eventid);
        }
    }
    
    that.scheduleItems = [];
    that.scheduleItemsShown = [];
    
    isFavorite=0;

    var data=transport.responseText;

    try {
      var scheduledata = data.evalJSON();
    }
    catch(e) {
        Mojo.Log.error(e);
    }

console.log("count="+scheduledata.events.length);

        for (j=0;j<=(scheduledata.events.length-1);j++) {
		eventCounter++;

                var isFavorite = jQuery.inArray(
            	    eventCounter,
	            that.tempFavorites
	        ) >= 0; // returns -1 if not found, otherwise the index

		console.log("dtstart="+j+" "+scheduledata.events[j].dtstart);
		var dateObj = that.parseDate(scheduledata.events[j].dtstart);
		that.scheduleItems.push({
	            id: eventCounter,
	            date: dateObj.day + '. ' + dateObj.monthname + ' ' + dateObj.year, 
	            dtstart: scheduledata.events[j].dtstart, 
	            time: dateObj.hour + ':' + dateObj.minute, 
	            location: scheduledata.events[j].location, 
		    etype: scheduledata.events[j].etype,
	            duration: scheduledata.events[j].duration,
	            title: scheduledata.events[j].title, 
	            description: scheduledata.events[j].description,
	            attendee: scheduledata.events[j].attendee,
	            url: scheduledata.events[j].url,
	            eventid: eventCounter,
	            pbfeventid: 0,
	            favorite: isFavorite
	        });
        }
console.log("scheduleItems="+that.scheduleItems.length);

/*
              that.scheduleItemsShown = that.scheduleItems;
              console.log("***** INCUBATED, NOW SETTING...");
              that.setEventItems( that.scheduleItemsShown );
                
              that.controller.instantiateChildWidgets($('schedule_list'));
                
              Mojo.Controller.getAppController().showBanner(
                    $L("Refreshed schedule items."),
                    { source: 'notification' }
              );
                
              that.viewFilterMenuModel.items[1].toggleCmd = 'cmdShowAll';
              that.controller.modelChanged(that.viewFilterMenuModel);
                
              console.log("***** SUCCESSFULLY SAVED.");
*/


    if( that.scheduleItems.length > 0 ) {
        // save to db if there are results
        this.depot.simpleAdd( 
            'schedule', 
            { items: that.scheduleItems }, 
            function() {
                that.scheduleItemsShown = that.scheduleItems;
                //console.log("***** INCUBATED, NOW SETTING...");
                that.setEventItems( that.scheduleItemsShown );
                
                that.controller.instantiateChildWidgets($('schedule_list'));
                
                Mojo.Controller.getAppController().showBanner(
                    $L("Refreshed schedule items."),
                    { source: 'notification' }
                );
                
                that.viewFilterMenuModel.items[1].toggleCmd = 'cmdShowAll';
                that.controller.modelChanged(that.viewFilterMenuModel);
                
                //console.log("***** SUCCESSFULLY SAVED.");
            }, 
            this.dbError 
        );
    }

}

ScheduleAssistant.prototype.showFiltered = function(type) {
    // type = all, favs, upcoming
    
    //console.log("***** STARTING HIDING EXPIRED...");

    this.spinnerModel.spinning = true;
    this.controller.modelChanged(this.spinnerModel);

    switch( type ) {
        
        case 'favs':
            this.scheduleItemsShown = this.scheduleItems.filter( function( element, index, array ) {
                if( element.favorite == true ) {
                    return true;
                }
                return false;
            } );
            break;
        
        case 'upcoming':
            this.scheduleItemsShown = this.scheduleItems.filter( function( element, index, array ) {
                var date = new Date();
                //var date = new Date(2010, 02, 06, 15, 30, 00);
                    
                var xcaldate = that.parseDate( element.dtstart );
                var dtstart = new Date( 
                    xcaldate.year,
                    xcaldate.month,
                    xcaldate.day,
                    xcaldate.hour,
                    xcaldate.minute,
                    00
                );
                
                var diffHours = Math.round( (date-dtstart) / (1000*60*60 ) );
                
                if( diffHours < 1 ) { // use a tolerance of one hour
                    return true;
                }
                
                return false;
            } );
            break;
            
        case 'all':
        default:
            // TODO: set filter back - maybe like filterFunction OR with disabled property of list?
            // Also make sure saving favorites in fav filter mode doesn't clear all
            // of the non-fav entries.
            this.scheduleItemsShown = this.scheduleItems;
            break;
            
    }
    
    //this.setEventItems( this.scheduleItems );
    
    this.listModel.items = this.scheduleItemsShown;
    this.controller.modelChanged(this.listModel);
    
    // re-set star states
    this.refreshFavStars();

    //stop the animation and hide the spinner
    this.spinnerModel.spinning = false;
    this.controller.modelChanged(this.spinnerModel);
}

// only "favorite" list property changes. this is handled here.
ScheduleAssistant.prototype.listPropertyChanged = function(event) {
    for( var i=0; i<this.scheduleItems.length; i++ ) {
        if( event.model.eventid == this.scheduleItems[i].eventid ) {
            
            if( event.value == true ) {
                jQuery('#star-'+event.model.id).addClass('starActive');
                this.scheduleItems[i].favorite = true;
            } else {
                jQuery('#star-'+event.model.id).removeClass('starActive');
                this.scheduleItems[i].favorite = false;
            }
        }
        
        // set open property to false to prevent saving drawer
        // open/close state
        this.scheduleItems[i].open = false;
    }
    
    // save modified data to db
    this.depot.simpleAdd(
        'schedule', 
        { items: this.scheduleItems }, 
        function() {
            //Mojo.Controller.getAppController().showBanner(
            //    $L("Saved favorite change."),
            //    { source: 'notification' }
            //);
            //console.log("***** SUCCESSFULLY SAVED.");
        }, 
        this.dbError 
    );
    
    //console.log(event.property+"#"+event.value+"##"+event.model.eventid+"###"+event.model.pbfeventid);
}

ScheduleAssistant.prototype.parseDate = function(xCalDate){
    var months = new Array(
        $L('January'), $L('February'), $L('March'), $L('April'),
        $L('May'), $L('June'), $L('July'), $L('August'),
        $L('September'), $L('October'), $L('November'), $L('December')
    );

    return {
        'year'      : xCalDate.substr(0,4),
        'month'     : xCalDate.substr(4,2),
        'monthname' : months[xCalDate.substr(4,2)-1],
        'day'       : xCalDate.substr(6,2),
        'hour'      : xCalDate.substr(9,2),
        'minute'    : xCalDate.substr(11,2)
    }
}

