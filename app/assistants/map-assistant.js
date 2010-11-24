function MapAssistant() {
	/* this is the creator function for your scene assistant object. It will be passed all the 
	   additional parameters (after the scene name) that were passed to pushScene. The reference
	   to the scene controller (this.controller) has not be established yet, so any initialization
	   that needs the scene controller should be done in the setup function below. */
}

MapAssistant.prototype.setup = function() {
	/* this function is for setup tasks that have to happen when the scene is first created */
		
	/* use Mojo.View.render to render view templates and add them to the scene, if needed. */
	
	/* setup widgets here */
	this.controller.stageController.setWindowOrientation('free');
	
	this.appMenuModel = {
		visible: true,
		items: [
			Mojo.Menu.editItem
		]
	};

	this.controller.setupWidget(Mojo.Menu.appMenu, {omitDefaultItems: true}, this.appMenuModel);
	
	var attributes = {};
	this.mapmodel = {};
	this.controller.setupWidget('campusMapView', attributes, this.mapmodel);
	this.myCampusMapView = $('campusMapView');
	
	/* add event handlers to listen to events from widgets */
}

MapAssistant.prototype.activate = function(event) {
	/* put in event handlers here that should only be in effect when this scene is active. For
	   example, key handlers that are observing the document */
    
    var width  = window.innerWidth;
	var height = window.innerHeight - parseInt(jQuery('#campusMapView').offset().top, 10);
 
	this.myCampusMapView.mojo.manualSize(width, height);
    
    this.myCampusMapView.mojo.centerUrlProvided('images/campus.png');
}

MapAssistant.prototype.orientationChanged = function(orientation) {
	this.activate();
}

MapAssistant.prototype.deactivate = function(event) {
	/* remove any event handlers you added in activate and do any other cleanup that should happen before
	   this scene is popped or another scene is pushed on top */
}

MapAssistant.prototype.cleanup = function(event) {
	/* this function should do any cleanup needed before the scene is destroyed as 
	   a result of being popped off the scene stack */
}
