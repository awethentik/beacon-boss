(function() {
	'use strict';

	angular.module('ikonnect.filters', [])
	//.filter('proximity', function(v) {
	//	var proximity = v;
	//	switch(proximity){
	//		case 'ProximityImmediate':
	//			proximity = 0;
	//			break;
	//		case 'ProximityNear':
	//			proximity = 1;
	//			break;
	//		case 'ProximityFar':
	//			proximity = 2;
	//			break;
	//		default:
	//			proximity = 3;
	//			break;
	//	}
	//	return proximity;
	//})
	.filter('dayCompare', dayCompare);

	function dayCompare() {
		return function (v){
			v = v.replace(/-/g,'/');
			var today = moment();
			var yesterday = moment().subtract(1, 'day');
			var tomorrow = moment().add(1, 'day');
			//console.log(v);
			//console.log(moment(new Date(v)));
			var engagementDate = moment(new Date(v));
			//console.log('engagementDate', engagementDate);

			if(moment(engagementDate).isSame(today, 'day')){
				//console.log('Today');
				engagementDate = 'Today';
			} else if(moment(engagementDate).isSame(yesterday, 'day')){
				//console.log('Yesterday');
				engagementDate = 'Yesterday';
			} else if(moment(engagementDate).isSame(tomorrow, 'day')){
				//console.log('Tomorrow');
				engagementDate = 'Tomorrow';
			} else {
				engagementDate = engagementDate.format('MM/DD/YYYY');
			}
			return engagementDate;
		};
	}

})();
