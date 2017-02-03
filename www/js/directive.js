(function() {
	'use strict';

	angular.module('ikonnect.directives', [])
	.directive('toggleItem', toggleItem);

	function toggleItem() {
		return function (key){
			var state = false;
			if(key == "Today"){
				state = true;
			} else {
				state = false;
			}
			return state;
		};
	}

})();
