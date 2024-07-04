document.addEventListener('DOMContentLoaded', function () {
    const token = getTokenFromUrl() || sessionStorage.getItem("authToken");
    if (!token) {
        // redirectToLogin();
    } else {
        sessionStorage.setItem("authToken", token);
        const userDetails = parseJwt(token);
        if (userDetails && userDetails.username) {
            sessionStorage.setItem("userEmail", userDetails.username);
            sessionStorage.setItem("userName", userDetails.name);
            validateTokenAndProceed(token);
        } else {
            // redirectToLogin();
        }
    }
  
function hideKAMSelectorIfRestricted() {
  const restrictedUsernames = ['Eduardo Macías', 'Esperanza Rivera', 'Fernando Vargas', 'Mariana Rivas'];
  const restrictedEmails = ['emacias@biancorelab.com', 'erivera@biancorelab.com', 'fvargas@biancorelab.com', 'mrivas@biancorelab.com'];

  const userEmail = sessionStorage.getItem("userEmail");
  const userName = sessionStorage.getItem("userName");

  if (restrictedUsernames.includes(userName) || restrictedEmails.includes(userEmail)) {
    const kamSelectorDiv = document.querySelector('#kams');
    if (kamSelectorDiv) {
      kamSelectorDiv.style.display = 'none'; // Oculta el selector de KAM
    }
    // Llama a setKAMSelectorOption para establecer el valor correcto y actualizar el dashboard
    setKAMSelectorOption();
  } else {
    setKAMSelectorOption();
  }
}
  
function setKAMSelectorOption() {
  const userEmail = sessionStorage.getItem("userEmail");
  const kamSelector = document.getElementById("kamSelector");
  if (kamSelector) {
    const emailToNameMapping = {
      'emacias@biancorelab.com': 'Eduardo Macías Beaz',
      'erivera@biancorelab.com': 'Esperanza Rivera Rodríguez',
      'fvargas@biancorelab.com': 'Fernando Vargas',
      'mrivas@biancorelab.com': 'Mariana Rivas Álvarez'
    };
    const odooName = emailToNameMapping[userEmail];
    if (odooName) {
      kamSelector.value = odooName;
      // Trigger the change event to update the dashboard
      const event = new Event('change');
      kamSelector.dispatchEvent(event);
    }
  }
}
  
    validateTokenAndProceed(token).then(() => {
      hideKAMSelectorIfRestricted();
    });
  
  });
  
  function getTokenFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('token');
  }
  
  function parseJwt(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error("Error parsing JWT: ", e);
      return null;
    }
  }
  
  // function redirectToLogin() {
  //   window.location.href = 'https://login-teal-three.vercel.app/';
  // }
  
  function validateTokenAndProceed(token) {
    return fetch('https://artistic-verdant-flock.glitch.me/validate-token', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(response => {
        if (response.ok) {
          return response.json();
        } else {
          redirectToLogin();
          throw new Error('Failed to validate token');
        }
      })
      .then(data => {
        const userDetails = parseJwt(token);
        if (userDetails && userDetails.username) {
          sessionStorage.setItem("userEmail", userDetails.username);
          sessionStorage.setItem("userName", userDetails.name);
          console.log('Access granted', data.user);
        } else {
          redirectToLogin();
        }
      })
      .catch(error => {
        console.error(error);
        redirectToLogin();
      });
  }
  