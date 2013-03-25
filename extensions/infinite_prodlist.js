/* **************************************************************

   Copyright 2011 Zoovy, Inc.

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.

************************************************************** */

/*
An extension for acquiring and displaying 'lists' of product data.
The functions here are designed to work with 'reasonable' size lists of product.
There are instances where a list may get looped through more than once to display the product. if several hundred product are present, it will get slow.
that being said, it's written to take a list of several hundred and break it into multiple pages. This makes for a better user experience.
currently, sorting is not available as part of the multipage header. ###
*/


var store_prodlist = function() {
	var r = {
	vars : {
		forgetmeContainer : {} //used to store an object of pids (key) for items that don't show in the prodlist. value can be app specific. TS makes sense.
		},

					////////////////////////////////////   CALLS    \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\		



	calls : {

/*
appProductGet includes all general product attributes (name, desc, base_price, etc)
the buildProdlist has a need for more advanced queries. appProductGet is for 'quick' lists where only basic info is needed.
getDetailedProduct supports variations, inventory and reviews.
more info may be passed in via obj, but only the pid is needed (so far).
the other info is passed in to keep the csv loop in getProductDataForList fairly tight.

datapointer must be set in the init because it needs to be passed into the callback, which may get executed without ever going in to dispatch() if the data is local
This also overrides the datapointer, if set. This is for consistency's sake.
The advantage of saving the data in memory and local storage is lost if the datapointer isn't consistent, especially for product data.

//formerly getProduct
*/
		appProductGet : {
			init : function(obj,tagObj,Q)	{
				var r = 0; //will return # of requests, if any. if zero is returned, all data needed was in local.
				var pid = obj.pid
				tagObj = $.isEmptyObject(tagObj) ? {} : tagObj; 
				tagObj["datapointer"] = "appProductGet|"+pid; 
//fetchData checks the timestamp, so no need to doublecheck it here unless there's a need to make sure it is newer than what is specified (1 day) in the fetchData function				
				if(app.model.fetchData('appProductGet|'+pid) == false)	{
					r = 2;
					this.dispatch(pid,tagObj,Q);
					}
				else	{
					app.u.handleCallback(tagObj)
					}
				return r;
				},
			dispatch : function(pid,tagObj,Q)	{
				var obj = {};
				obj["_cmd"] = "appProductGet";
				obj["pid"] = pid;
				obj["_tag"] = tagObj;
				app.model.addDispatchToQ(obj,Q);
				}
			}, //appProductGet

//allows for acquiring inventory, variations and or reviews. set withVariations="1" or withInventory="1" or withReviews="1"
//set pid=pid in obj
		getDetailedProduct : {
			init : function(obj,tagObj,Q)	{
				var r = 0; //will return 1 if a request is needed. if zero is returned, all data needed was in local.
//				app.u.dump("BEGIN app.ext.store_product.calls.appProductGet");
//				app.u.dump(" -> PID: "+obj.pid);
//				app.u.dump(" -> obj['withReviews']: "+obj['withReviews']);
				tagObj = $.isEmptyObject(tagObj) ? {} : tagObj; 
				tagObj["datapointer"] = "appProductGet|"+obj.pid; 

//fetchData checks the timestamp, so no need to doublecheck it here unless there's a need to make sure it is newer than what is specified (1 day) in the fetchData function				
				if(app.model.fetchData(tagObj.datapointer) == false)	{
//					app.u.dump(" -> appProductGet not in memory or local. refresh both.");
					r += 1;
					}
				else if(obj['withInventory'] && typeof app.data[tagObj.datapointer]['@inventory'] == 'undefined')	{
					r += 1;
					}
				else if(obj['withVariations'] && typeof app.data[tagObj.datapointer]['@variations'] == 'undefined')	{
					r += 1;
					
					}
//  && app.model.addDispatchToQ(obj,Q) -> not sure why this was here.
				if(obj['withReviews'])	{
//callback will b on appProductGet, but make sure this request is first so that when callback is executed, this is already in memory.
					r += app.ext.store_prodlist.calls.appReviewsList.init(obj.pid,{},Q);
					}
					
//To ensure accurate data, if inventory or variations are desired, data is requested.
//r will be greater than zero if product record not already in local or memory
				if(r == 0) 	{
					app.u.handleCallback(tagObj)
					}
				else	{
					this.dispatch(obj,tagObj,Q)
					}

				return r;
				},
			dispatch : function(obj,tagObj,Q)	{
				obj["_cmd"] = "appProductGet";
				obj["_tag"] = tagObj;
				app.model.addDispatchToQ(obj,Q);
				}
			}, //appProductGet

		

//formerly getReviews
		appReviewsList : {
			init : function(pid,tagObj,Q)	{
				var r = 0; //will return a 1 or a 0 based on whether the item is in local storage or not, respectively.

				tagObj = $.isEmptyObject(tagObj) ? {} : tagObj;
				tagObj["datapointer"] = "appReviewsList|"+pid;

				if(app.model.fetchData('appReviewsList|'+pid) == false)	{
					r = 1;
					this.dispatch(pid,tagObj,Q)
					}
				else	{
					app.u.handleCallback(tagObj)
					}
				return r;
				},
			dispatch : function(pid,tagObj,Q)	{
				app.model.addDispatchToQ({"_cmd":"appReviewsList","pid":pid,"_tag" : tagObj},Q);	
				}
			}//appReviewsList

		}, //calls









					////////////////////////////////////   CALLBACKS    \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\









	callbacks : {
//callbacks.init need to return either a true or a false, depending on whether or not the file will execute properly based on store account configuration.
		init : {
			onSuccess : function()	{
//				app.u.dump('BEGIN app.ext.store_prodlist.init.onSuccess ');
				return true;  //currently, there are no config or extension dependencies, so just return true. may change later.
//				app.u.dump('END app.ext.store_prodlist.init.onSuccess');
				},
			onError : function()	{
				app.u.dump('BEGIN app.ext.store_prodlist.callbacks.init.onError');
				}
			},
/*
A special translate template for product so that reviews can be merged into the data passed into the template rendering engine.
*/
		translateTemplate : {
			onSuccess : function(tagObj)	{
//				app.u.dump("BEGIN app.ext.store_prodlist.callbacks.translateTemplate.onSuccess");
//				app.u.dump(tagObj);
//				app.u.dump(" -> tagObj.datapointer = "+tagObj.datapointer);
//				app.u.dump(" -> tagObj.parentID = "+tagObj.parentID+" and $(#"+tagObj.parentID+").length: "+$('#'+tagObj.parentID).length);
				var tmp = app.data[tagObj.datapointer];
				var pid = app.data[tagObj.datapointer].pid;
//				app.u.dump(" -> typeof app.data['appReviewsList|'+pid]:"+ typeof app.data['appReviewsList|'+pid]);
				if(typeof app.data['appReviewsList|'+pid] == 'object'  && app.data['appReviewsList|'+pid]['@reviews'].length)	{
//					app.u.dump(" -> Item ["+pid+"] has "+app.data['appReviewsList|'+pid]['@reviews'].length+" review(s)");
					tmp['reviews'] = app.ext.store_prodlist.u.summarizeReviews(pid); //generates a summary object (total, average)
					tmp['reviews']['@reviews'] = app.data['appReviewsList|'+pid]['@reviews']
					}
				$(app.u.jqSelector('#',tagObj.parentID)).anycontent({'datapointer':tagObj.datapointer});
//				app.renderFunctions.translateTemplate(app.data[tagObj.datapointer],tagObj.parentID);
				},
//error needs to clear parent or we end up with orphans (especially in UI finder).
			onError : function(responseData,uuid)	{
				responseData.persistant = true; //throwMessage will NOT hide error. better for these to be pervasive to keep merchant fixing broken things.
				var $parent = $('#'+responseData['_rtag'].parentID)
				$parent.empty().removeClass('loadingBG');
				app.u.throwMessage(responseData,uuid);
//for UI prod finder. if admin session, adds a 'remove' button so merchant can easily take missing items from list.
// ### !!! NOTE - upgrade this to proper admin verify (function)
				if(app.vars.cartID && app.vars.cartID.indexOf('**') === 0)	{
					$('.ui-state-error',$parent).append("<button class='ui-state-default ui-corner-all'  onClick='app.ext.admin.u.removePidFromFinder($(this).closest(\"[data-pid]\"));'>Remove "+responseData.pid+"<\/button>");
					}
				}
			},

//put an array of sku's into memory for quick access. This array is what is used in filterProdlist to remove items from the forgetme list.
		handleForgetmeList : {
			onSuccess : function(tagObj)	{
				var L = app.data['getCustomerList|forgetme']['@forgetme'].length
				app.ext.store_prodlist.vars.forgetmeContainer.csv = []; //reset list.
				for(var i = 0; i < L; i += 1)	{
					app.ext.store_prodlist.vars.forgetmeContainer.csv.push(app.data['getCustomerList|forgetme']['@forgetme'][i].SKU)
					}
				}
			}

		}, //callbacks







						////////////////////////////////////   RENDERFORMATS    \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\





	renderFormats : {
			
//a product list needs an ID for multipage to work right. will assign a random one if none is set.
//that parent ID is prepended to the sku and used in the list item id to decrease likelyhood of duplicate id's
//data.bindData will get passed into getProdlistVar and used for defaults on the list itself. That means any var supported in prodlistVars can be set in bindData.

			productList : function($tag,data)	{
//				app.u.dump("BEGIN store_prodlist.renderFormats.productList");
//				app.u.dump(" -> data.bindData: "); app.u.dump(data.bindData);
				if(app.u.isSet(data.value))	{
					data.bindData.csv = data.value;
					app.ext.store_prodlist.u.buildProductList(data.bindData,$tag);
					}
				}//prodlist		

			},





////////////////////////////////////   						util [u]			    \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\





		u : {




/*
This is the function that gets executed to build a product list.
obj is most likely the databind object. It can be any params set in setProdlistVars.
params that are missing will be auto-generated.
*/
			buildProductList : function(obj,$tag)	{
//				app.u.dump("BEGIN store_prodlist.u.buildProductList()");
//				app.u.dump(" -> obj: "); app.u.dump(obj);

//Need either the tag itself ($tag) or the parent id to build a list. recommend $tag to ensure unique parent id is created
//also need a list of product (csv)
				if($tag && obj.csv)	{
//					app.u.dump(" -> required parameters exist. Proceed...");
					obj.csv = app.ext.store_prodlist.u.cleanUpProductList(obj.csv); //strip blanks and make sure this is an array. prod attributes are not, by default.
					
					var plObj = app.ext.store_prodlist.u.setProdlistVars(obj); //full prodlist object now.

//adds all the placeholders. must happen before getProductDataForList so individual product translation can occur.
//can't just transmogrify beccause sequence is important and if some data is local and some isn't, order will get messed up.
					$tag.data('prodlist',plObj); //sets data object on parent

					var pageCSV = app.ext.store_prodlist.u.getSkusForThisPage(plObj), //gets a truncated list based on items per page.
					L = pageCSV.length;
//Go get ALL the data and render it at the end. Less optimal from a 'we have it in memory already' point of view, but solves a plethora of other problems.
					for(var i = 0; i < L; i += 1)	{
						numRequests += app.calls.appProductGet.init({
							"pid":pageCSV[i],
							"withVariations":plObj.withVariations,
							"withInventory":plObj.withInventory
							},{},'mutable');
						if(plObj.withReviews)	{
							numRequests += app.calls.appReviewsList.init(pageCSV[i],{},'mutable');
							}
						}
					app.calls.ping.init({'callback':function(rd){
						if(app.model.responseHasErrors(rd)){
							$tag.parent().anymessage({'message':rd});
							}
						else	{
							for(var i = 0; i < L; i += 1)	{
								//add template and translate.
								}
							}
						}},'mutable');
					app.model.dispatchThis();
					 //will render individual product, if data already present or fetch data and render as part of response.

					}
				else	{
					app.u.throwGMessage("WARNING: store_prodlist.u.buildProductList is missing some required fields. Obj follows: ");
					app.u.dump(obj);
					}
//				app.u.dump(" -> r = "+r);
				} //buildProductList

			} //util

		
		} //r object.
	return r;
	}