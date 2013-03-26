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


var infinite_prodlist = function() {
	var r = {
	vars : {
		forgetmeContainer : {} //used to store an object of pids (key) for items that don't show in the prodlist. value can be app specific. TS makes sense.
		},


					////////////////////////////////////   CALLBACKS    \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\









	callbacks : {
//callbacks.init need to return either a true or a false, depending on whether or not the file will execute properly based on store account configuration.
		init : {
			onSuccess : function()	{
//				app.u.dump('BEGIN app.ext.store_prodlist.init.onSuccess ');
				return true;  //currently, there are no config or extension dependencies, so just return true. may change later.
//unbind this from window anytime a category page is left.
//NOTE! if infinite prodlist is used on other pages, remove run this on that template as well.
				app.rq.push(['templateFunction','categoryTemplate','onCompletes',function(P) {
					$(window).off('scroll.infiniteScroll'); 
					}]);
				
//				app.u.dump('END app.ext.store_prodlist.init.onSuccess');
				},
			onError : function()	{
				app.u.dump('BEGIN app.ext.store_prodlist.callbacks.init.onError');
				}
			}

		}, //callbacks







						////////////////////////////////////   RENDERFORMATS    \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\





	renderFormats : {
			
//a product list needs an ID for multipage to work right. will assign a random one if none is set.
//that parent ID is prepended to the sku and used in the list item id to decrease likelyhood of duplicate id's
//data.bindData will get passed into getProdlistVar and used for defaults on the list itself. That means any var supported in prodlistVars can be set in bindData.

			infiniteProductList : function($tag,data)	{
//				app.u.dump("BEGIN infinite_prodlist.renderFormats.infiniteProductList");
//				app.u.dump(" -> data.bindData: "); app.u.dump(data.bindData);
				if(app.u.isSet(data.value))	{
					data.bindData.csv = data.value;
					$tag.data('bindData',data.bindData);
					app.ext.infinite_prodlist.u.buildInfiniteProductList($tag);
					}
				}//prodlist		

			},





////////////////////////////////////   						util [u]			    \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\





		u : {




/*
This is the function that gets executed to build a product list.
It is run once, executed by the renderFormat.
*/
			buildInfiniteProductList : function($tag)	{
//				app.u.dump("BEGIN store_prodlist.u.buildInfiniteProductList()");
//				app.u.dump(" -> obj: "); app.u.dump(obj);

				var bindData = $tag.data('bindData');

				$tag.parent().append($("<div \/>").addClass('loadingBG').attr('data-app-role','infiniteProdlistLoadIndicator'));

//Need either the tag itself ($tag) or the parent id to build a list. recommend $tag to ensure unique parent id is created
//also need a list of product (csv)
				if($tag && bindData.csv)	{
//					app.u.dump(" -> required parameters exist. Proceed...");
					bindData.csv = app.ext.store_prodlist.u.cleanUpProductList(bindData.csv); //strip blanks and make sure this is an array. prod attributes are not, by default.
					this.addProductToPage($tag);
					}
				else	{
					app.u.throwGMessage("WARNING: store_prodlist.u.buildInfiniteProductList is missing some required fields. bindData follows: ");
					app.u.dump(bindData);
					}
//				app.u.dump(" -> r = "+r);
				}, //buildInfiniteProductList

			addProductToPage : function($tag)	{
				app.u.dump("BEGIN infinite_prodlist.u.addProductToPage");
				$tag.data('isDispatching',true);
				
				var plObj = app.ext.store_prodlist.u.setProdlistVars($tag.data('bindData')),
				numRequests = 0,
				pageCSV = app.ext.store_prodlist.u.getSkusForThisPage(plObj), //gets a truncated list based on items per page.
				L = pageCSV.length;
				$tag.data('prodlist',plObj); //sets data object on parent

//Go get ALL the data and render it at the end. Less optimal from a 'we have it in memory already' point of view, but solves a plethora of other problems.
				for(var i = 0; i < L; i += 1)	{
					numRequests += app.calls.appProductGet.init({
						"pid":pageCSV[i],
						"withVariations":plObj.withVariations,
						"withInventory":plObj.withInventory
						},{},'mutable');
					if(plObj.withReviews)	{
						numRequests += app.ext.store_prodlist.calls.appReviewsList.init(pageCSV[i],{},'mutable');
						}
					}
				
				var infiniteCallback = function(rd)	{
					$tag.data('isDispatching',false); //toggle T/F as a dispatch occurs so that only 1 infinite scroll dispatch occurs at a time.
					if(app.model.responseHasErrors(rd)){
						$tag.parent().anymessage({'message':rd});
						}
					else	{
						for(var i = 0; i < L; i += 1)	{
							//if you want this list inventory aware, do you check here and skip the append below.
							$tag.append(app.renderFunctions.transmogrify({'pid':pageCSV[i]},plObj.loadsTemplate,app.data['appProductGet|'+pageCSV[i]]));
							}
						app.ext.infinite_prodlist.u.handleScroll($tag);
						}				
					}

				if(numRequests == 0)	{
					infiniteCallback({})
					}
				else	{
					app.calls.ping.init({'callback':infiniteCallback},'mutable');
					app.model.dispatchThis();
					}

				},

			handleScroll : function($tag)	{
var plObj = $tag.data();
if(plObj.prodlist.csv.length <= plObj.prodlist.items_per_page)	{$tag.parent().find("[data-app-role='infiniteProdlistLoadIndicator']").hide();} //do nothing. fewer than 1 page worth of items.
else if(plObj.prodlist.page_in_focus >= plObj.prodlist.total_page_count)	{
//reached the last 'page'. disable infinitescroll.
	$(window).off('scroll.infiniteScroll');
	$tag.parent().find("[data-app-role='infiniteProdlistLoadIndicator']").hide();
	}
else	{
	$(window).on('scroll.infiniteScroll',function(){
		//will load data when two rows from bottom.
		if( $(window).scrollTop() >= ( $(document).height() - $(window).height() - ($tag.children().first().height() * 2) ) )	{
			if($tag.data('isDispatching') == true)	{}
			else	{
				plObj.prodlist.page_in_focus += 1;
				$tag.data('prodlist',plObj.prodlist);
				app.ext.infinite_prodlist.u.addProductToPage($tag);
				}
			}
		});
	}

				}

			} //util

		
		} //r object.
	return r;
	}