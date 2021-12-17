const am_backend = "https://backend.shoptype.com";
let am_platformId = null;
let productPage = null;
let brandPage = null;
let offset = 0;
let scrollContainer = null;
let am_platform_brands = null;
const am_currentUrl = new URL(window.location);
const am_Currency = {"USD":"$", "INR":"₹","GBP":"£"};
const marketLoaded = new Event('marketLoaded');
let am_loadedContainers = [];

function initMarket(){
	let awakeTags = document.getElementsByTagName("awakeMarket");
	if(awakeTags && awakeTags.length>0){
		am_platformId = awakeTags[0].getAttribute("platformid");
		productPage = awakeTags[0].getAttribute("productpage");
		brandPage = awakeTags[0].getAttribute("brandPage");
	}else{
		console.error("awakeMarket tag not found");
	}
}

function awakenTheMarket(){
	initMarket();
	if (am_platformId && am_platformId!="") {
		populateProducts();
		populateBrands();
	}else{
		console.error("Shoptype platformId not set");
	}
}

function populateProducts(){
	let productLists = document.getElementsByClassName('products-container');
	for (var i = 0; i < productLists.length; i++) {
		offset = 0;
		addProducts(productLists[i]);
		if(productLists[i].getAttribute('loadmore')=='true'){
			scrollContainer = productLists[i];
			window.addEventListener('scroll',()=>{
				const {scrollHeight,scrollTop,clientHeight} = document.documentElement;
				if(scrollTop + clientHeight > scrollHeight - 5){
					addProducts(scrollContainer);
				}
			});
		}
	}
}

function populateBrands(){
	let brandsLists = document.getElementsByClassName('brands-container');
	for (var i = 0; i < brandsLists.length; i++) {
		let count = brandsLists[i].getAttribute("count")??20;
		let brandTemplate = brandsLists[i].querySelector(".brand-container");
		getBrands(brandsLists[i], brandTemplate, count)
	}
	populateBrandSelector();
}

function populateBrandSelector(){
	let brandSelect = document.querySelector('.am-brands-selector');
	if(brandSelect){
		fetchBrands(function(brandsJson){
			for (var i = 0; i < brandsJson.length; i++) {
				var opt = document.createElement('option');
				opt.value = brandsJson[i].id;
				opt.innerHTML = brandsJson[i].name;
	    		brandSelect.appendChild(opt);
			}
		});
		brandSelect.setAttribute("onchange","brandChanged(this)");
	}
}

function brandChanged(selectElement){
	let querySelector = selectElement.getAttribute("productsContainer");
	let productsContainer = document.querySelector(querySelector);
	let value = selectElement.options[selectElement.selectedIndex].value;
	if(value ==""){
		productsContainer.removeAttribute("vendorId");
	}else{
		productsContainer.setAttribute("vendorId",value);
	}
	clearProducts(productsContainer);
	offset=0;
	addProducts(productsContainer);
}

function addTagSelect(){
	let tagSelects = document.getElementsByClassName('am-tag-selector');
	for (var i = 0; i < tagSelects.length; i++) {
		tagSelects[i].setAttribute("onchange","tagChanged()");
	}
}

function tagChanged(){
	let tagSelects = document.getElementsByClassName('am-tag-selector');
	let tags = "";
	for (var i = 0; i < tagSelects.length; i++) {
		let value = tagSelects[i].options[tagSelects[i].selectedIndex].value;
		let operator = tags==""?"":tagSelects[i].getAttribute("operator")??"";
		if(value && value!=""){
			tags+=operator+value;
		}
	}

	let querySelector = tagSelects[0].getAttribute("productsContainer");
	let productsContainer = document.querySelector(querySelector);
	productsContainer.setAttribute("tags",tags);
	clearProducts(productsContainer);
	offset=0;
	addProducts(productsContainer);
}

function addProducts(productsContainer){
	if(am_loadedContainers.includes(productsContainer)){return;}
	let skip = productsContainer.getAttribute('skip')==null?false:true;
	let removeTemplate = productsContainer.getAttribute('removeTemplate')==null?false:true && !(productsContainer.getAttribute('loadmore')=='true');
	if(skip){return;}
	let productTemplate = productsContainer.querySelector(".product-container");
	productTemplate.style.display = "none";
	let searchString = productsContainer.getAttribute('searchstring');
	let collection = productsContainer.getAttribute('collection');
	let minRange = productsContainer.getAttribute('minRange');
	let maxRange = productsContainer.getAttribute('maxRange');
	let category = productsContainer.getAttribute('category');
	let tags = productsContainer.getAttribute('tags');
	let vendorId = productsContainer.getAttribute('vendorId');
	let count = productsContainer.getAttribute('count')?parseInt(productsContainer.getAttribute('count')):20;
	let imageSize = productsContainer.getAttribute('imageSize');
	let params = "count="+count;
	params += "&offset=" + offset;
	params += imageSize?"&imgSize="+imageSize:"";
	params += searchString?"&text="+searchString:"";
	params += minRange?"&minRange="+minRange:"";
	params += maxRange?"&maxRange="+maxRange:"";
	params += category?"&category="+category:"";
	params += tags?"&tags="+tags:"";
	params += vendorId?"&vendorId="+vendorId:"";
	fetchProducts(params, productsContainer, productTemplate);
	if(removeTemplate){
		productTemplate.remove();
	}
	offset+=count??10;
}

function loadProduct(productId, successCB, failureCB){
	if(typeof fingerprintExcludeOptions!== 'undefined'){
		fetchProduct(productId, successCB, failureCB);
	}else{
		am_loadScript("https://shoptype-scripts.s3.amazonaws.com/triggerUserEvent.js", function(){ensureFingerprint2(productId, successCB, failureCB);});
	}
}

function ensureFingerprint2(productId, successCB, failureCB){
	if(typeof Fingerprint2!== 'undefined'){
		fetchProduct(productId, successCB, failureCB);
	}else{
		setTimeout(function(){ ensureFingerprint2(productId, successCB, failureCB); }, 500);
	}
}

function fetchProduct(productId, successCB, failureCB){
	let tid = am_currentUrl.searchParams.get("tid");
	getDeviceId()
		.then(deviceId =>{
			let payload = {
				"device_id": deviceId
			}
			if(tid){payload['tracker_id']=tid;}
			let headerOptions = {
				method:'post',
				'headers': {'content-type': 'application/json'},
				body: JSON.stringify(payload)
			};
			fetch(am_backend + `/platforms/${am_platformId}/products/${productId}`, headerOptions)
				.then(response=>{
					if (response.status >= 200 && response.status < 300) {
						return Promise.resolve(response.json());
					}else{
						return Promise.reject("Product not found")
					}
				})
				.then(productJson=>{
					updateProduct(productJson.product);
					if(isFunction(successCB)){successCB(productJson);}
				})
				.catch(function() {
					console.log("Product not found");
					if(isFunction(failureCB)){failureCB("Product not found");}
				});
		});
}

function loadBrand(brandId, successCB, failureCB){
	fetch(am_backend + `/platforms/${am_platformId}/vendors?vendorId=${brandId}`)
		.then(response=>{
			if (response.status >= 200 && response.status < 300) {
				return Promise.resolve(response.json());
			}else{
				return Promise.reject("Brand not found")
			}
		})
		.then(brandJson=>{
			if(brandJson[0]){
				updateBrand(brandJson[0]);
				if(isFunction(successCB)){successCB(brandJson[0]);}				
			}else{
				if(isFunction(failureCB)){failureCB("Brand not found");}
			}
		})
		.catch(function() {
			console.log("Brand not found");
			if(isFunction(failureCB)){failureCB("Brand not found");}
		});
}

function updateProduct(product){
	let productNode = document.querySelector(".am-product-display-container")
	productNode.querySelector(".am-product-main-image").src = product.primaryImageSrc.imageSrc;
	let imagesTemplate = productNode.querySelector(".am-product-other-image");
	if(imagesTemplate && product.secondaryImageSrc){
		for (var i = 0; i < product.secondaryImageSrc.length; i++) {
			let newImg = imagesTemplate.cloneNode(true);
			newImg.src = product.secondaryImageSrc[i].imageSrc;
			imagesTemplate.parentNode.appendChild(newImg);
		}
	}
	productNode.querySelector(".am-product-title").innerHTML = product.title;
	productNode.querySelector(".am-product-vendor").innerHTML = product.vendorName;
	productNode.querySelector(".am-product-price").innerHTML = getPriceStr(product.variants[0].discountedPriceAsMoney);
	productNode.querySelector(".am-product-description").innerHTML = product.description?product.description.replace(/(?:\r\n|\r|\n)/g, '<br>'):"not available";
	let tags = productNode.querySelector(".am-product-tags");
	if(tags){tags.innerHTML = product.tags.join(',');}
	let addToCartBtn = productNode.querySelector(".am-product-add-cart-btn");
	if(addToCartBtn){
		setCartBtnAttributes(addToCartBtn, product);
	}
	let cosellBtn = productNode.querySelector(".am-cosell-btn");
	if(cosellBtn){
		setCosellAttributes(cosellBtn, product);
	}
	let buyBtn = productNode.querySelector(".am-product-buy-btn");
	if(buyBtn){
		setCartBtnAttributes(buyBtn, product);
	}
	productNode.style.display="";
}

function updateBrand(brand){
	let brandNode = document.querySelector(".am-brand-display-container")
	brandNode.querySelector(".am-brand-name").innerHTML = brand.name;
	brandNode.querySelector(".am-brand-logo").src = brand.logo;
	let brandCat = brandNode.querySelector(".am-brand-categories");
	if(brandCat){brandCat.innerHTML = brand.productCategories?brand.productCategories.join(","):"";}
	let brandUrl = brandNode.querySelector(".am-brand-pageUrl");
	if(brandUrl){brandUrl.href = brand.url;}
	let brandCountryState=brandNode.querySelector(".am-brand-countryState")
	if(brandCountryState){brandCountryState.innerHTML = brand.store.countryState;}
	
	let brandProducts = brandNode.querySelector(".products-container");
	if(brandProducts){
		brandProducts.setAttribute("vendorid",brand.id);
		brandProducts.removeAttribute("skip");
		addProducts(brandProducts)
	}

}

function am_updateProductQuant(optionsSelector){

}

function fetchProducts(params, productsContainer, productTemplate){
	fetch(am_backend + `/platforms/${am_platformId}/products?` + params)
		.then(response=>{
			if (response.status >= 200 && response.status < 300) {
				return Promise.resolve(response.json());
			}else{
				return Promise.reject("nothing here");
			}
		})
		.then(productsJson=>{
			for (var i = 0; i < productsJson.products.length; i++) {
				let product = productsJson.products[i];
				let newProduct = createProduct(productTemplate, product);
				newProduct.style.display = "";
				productsContainer.appendChild(newProduct);
			}
			var amProductsLoaded = new CustomEvent("amProductsLoaded", {'container': productsContainer});
			document.dispatchEvent(amProductsLoaded);
		})		
		.catch(function() {
			console.log("No more products to load");
			var amProductsLoadFailed = new CustomEvent("amProductsLoadFailed", {'container': productsContainer});
			document.dispatchEvent(amProductsLoadFailed);
			am_loadedContainers.push(productsContainer);
		});
}

function clearProducts(productsContainer){
	var children = productsContainer.getElementsByClassName("product-container");
	am_loadedContainers=[];
	offset = 0;
	for (var i = children.length - 1; i >= 1; i--) {
		children[i].remove();
	}
}

function createProduct(productTemplate, product){
	let newProduct = productTemplate.cloneNode(true);
	newProduct.id = product.id;
	newProduct.querySelector(".am-product-image").src = product.primaryImageSrc.imageSrc;
	newProduct.querySelector(".am-product-title").innerHTML = product.title;
	newProduct.querySelector(".am-product-vendor").innerHTML = product.vendorName;
	let productPrice = newProduct.querySelector(".am-product-price");
	if(productPrice){
		productPrice.innerHTML = getPriceStr(product.variants[0].discountedPriceAsMoney);
	}
	let addToCartBtn = newProduct.querySelector(".am-product-add-cart-btn");
	if(addToCartBtn){
		setCartBtnAttributes(addToCartBtn, product);
	}
	let buyBtn = newProduct.querySelector(".am-product-buy-btn");
	if(buyBtn){
		setCartBtnAttributes(buyBtn, product);
	}	
	let productLink = newProduct.querySelector(".am-product-link");
	if(productLink){productLink.href = productPage.replace("{{productId}}", product.id);}
	return newProduct;
}

function setCartBtnAttributes(btn, product){
		btn.setAttribute("variantid",product.variants[0].id);
		btn.setAttribute("productid",product.id);
		btn.setAttribute("vendorid",product.vendor.id);
		btn.setAttribute("quantitySelect",".am-add-cart-quantity");
}

function setCosellAttributes(btn, product){
		btn.setAttribute("onclick", `showCosell("${product.id}")`);
		btn.innerHTML = btn.innerHTML.replace('{{commission}}', getCommissionStr(product));
}
function onVariantSelectChanged(){

}

function getPriceStr(money,decimal=2){
	let curr = am_Currency[money.currency]?am_Currency[money.currency]:money.currency;
	return curr + " " + Number(money.amount).toFixed(decimal);
}

function getCommissionStr(product,decimal=2){
	let curr = am_Currency[product.currency]?am_Currency[product.currency]:product.currency;
	let commission = product.variants[0].discountedPriceAsMoney.amount * product.productCommission.percentage / 100;
	return curr + " " + Number(commission).toFixed(decimal);
}

function getBrands(brandsContainer, brandTemplate, count=50){
	let removeTemplate = brandsContainer.getAttribute('removeTemplate')==null?false:true && !(brandsContainer.getAttribute('loadmore')=='true');
	
	fetchBrands(function(brandsJson){
		for (var i = 0; i < brandsJson.length||i<count; i++) {
			let brand = brandsJson[i];
			let newBrand = createBrand(brandTemplate, brand);
			newBrand.style.display = "";
			brandsContainer.appendChild(newBrand);
		}
		var amBrandsLoaded = new CustomEvent("amBrandsLoaded", {'container': brandsContainer});
		if(removeTemplate){
			brandTemplate.remove();
		}
		document.dispatchEvent(amBrandsLoaded);
	});
}

function fetchBrands(callback){
	if(am_platform_brands){
		callback(am_platform_brands);
	}else{
		fetch(am_backend + `/platforms/${am_platformId}/vendors`)
			.then(response=>response.json())
			.then(brandsJson=>{
				am_platform_brands = brandsJson;
				callback(brandsJson);
			});
	}
}

function createBrand(brandTemplate, brand){
	let newBrand = brandTemplate.cloneNode(true);
	newBrand.id = brand.id;
	newBrand.querySelector(".am-brand-image").src = brand.logo;
	newBrand.querySelector(".am-brand-name").innerHTML = brand.name;
	let brandId=newBrand.querySelector(".am-brand-id");
	if(brandId){brandId.innerHTML = brand.id;}
	let brandLink = newBrand.querySelector(".am-brand-link");
	if(brandLink){brandLink.href = brandPage.replace("{{brandId}}", brand.id);}
	return newBrand;
}

function am_loadScript(url, callback) {
	var head = document.head;
	var script = document.createElement('script');
	script.type = 'text/javascript';
	script.src = url;
	script.onreadystatechange = callback;
	script.onload = callback;
	head.appendChild(script);
}

function isFunction(functionName) {
    if(eval("typeof(" + functionName + ") == typeof(Function)")) {
        return true;
    }else{
    	return false;
    }
}

document.dispatchEvent(marketLoaded);